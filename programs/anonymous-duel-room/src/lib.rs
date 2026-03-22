use ephemeral_rollups_sdk::{
    cpi::{delegate_account, undelegate_account, DelegateAccounts, DelegateConfig},
    ephem::{commit_accounts, commit_and_undelegate_accounts},
};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    system_program,
    sysvar::Sysvar,
};
use thiserror::Error;

const ROOM_PROGRAM_SEED: &[u8] = b"room";
const ROOM_CODE_BYTES: usize = 6;
const MAX_PARTICIPANTS: usize = 2;
const MAX_MESSAGES: usize = 12;
const MAX_MESSAGE_BYTES: usize = 96;

const ROOM_ACCOUNT_DISCRIMINATOR: u8 = 1;
const UNDELEGATE_CALLBACK_DISCRIMINATOR: [u8; 8] = [196, 28, 41, 206, 48, 37, 51, 167];
const DEFAULT_DEVNET_VALIDATOR: &str = "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd";

const STATUS_WAITING: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_CLOSED: u8 = 2;

const TAG_CREATE_ROOM: u8 = 0;
const TAG_JOIN_ROOM: u8 = 1;
const TAG_LEAVE_ROOM: u8 = 2;
const TAG_SEND_MESSAGE: u8 = 3;
const TAG_PUSH_PAYMENT_EVENT: u8 = 4;
const TAG_CLOSE_ROOM: u8 = 5;
const TAG_DELEGATE_ROOM: u8 = 6;
const TAG_COMMIT_ROOM: u8 = 7;
const TAG_COMMIT_AND_UNDELEGATE_ROOM: u8 = 8;

const PARTICIPANT_SLOT_BYTES: usize = 32 + 1 + 8;
const MESSAGE_SLOT_BYTES: usize = 32 + 8 + 2 + 1 + MAX_MESSAGE_BYTES;
const ROOM_HEADER_BYTES: usize = 1 + 1 + 1 + ROOM_CODE_BYTES + 32 + 1 + 4 + 2 + 8 + 8 + 8;
const ROOM_ACCOUNT_BYTES: usize = ROOM_HEADER_BYTES
    + (PARTICIPANT_SLOT_BYTES * MAX_PARTICIPANTS)
    + (MESSAGE_SLOT_BYTES * MAX_MESSAGES);

#[derive(Clone, Copy, Debug, Default)]
struct ParticipantSlot {
    wallet: [u8; 32],
    connected: u8,
    last_seen_at: i64,
}

#[derive(Clone, Copy, Debug)]
struct MessageSlot {
    sender: [u8; 32],
    sent_at: i64,
    body_len: u16,
    status: u8,
    body: [u8; MAX_MESSAGE_BYTES],
}

impl Default for MessageSlot {
    fn default() -> Self {
        Self {
            sender: [0; 32],
            sent_at: 0,
            body_len: 0,
            status: 0,
            body: [0; MAX_MESSAGE_BYTES],
        }
    }
}

#[derive(Clone, Debug)]
struct RoomState {
    discriminator: u8,
    bump: u8,
    status: u8,
    room_code: [u8; ROOM_CODE_BYTES],
    creator: [u8; 32],
    participant_count: u8,
    next_message_seq: u32,
    message_count: u16,
    created_at: i64,
    updated_at: i64,
    last_active_at: i64,
    participants: [ParticipantSlot; MAX_PARTICIPANTS],
    messages: [MessageSlot; MAX_MESSAGES],
}

impl Default for RoomState {
    fn default() -> Self {
        Self {
            discriminator: 0,
            bump: 0,
            status: STATUS_WAITING,
            room_code: [0; ROOM_CODE_BYTES],
            creator: [0; 32],
            participant_count: 0,
            next_message_seq: 0,
            message_count: 0,
            created_at: 0,
            updated_at: 0,
            last_active_at: 0,
            participants: [ParticipantSlot::default(); MAX_PARTICIPANTS],
            messages: [MessageSlot::default(); MAX_MESSAGES],
        }
    }
}

#[derive(Debug, Error)]
enum RoomError {
    #[error("invalid instruction")]
    InvalidInstruction,
    #[error("invalid room code")]
    InvalidRoomCode,
    #[error("invalid room account")]
    InvalidRoomAccount,
    #[error("room already initialized")]
    RoomAlreadyInitialized,
    #[error("room not initialized")]
    RoomNotInitialized,
    #[error("room is full")]
    RoomFull,
    #[error("participant not found")]
    ParticipantNotFound,
    #[error("participant is not connected")]
    ParticipantNotConnected,
    #[error("message too long")]
    MessageTooLong,
    #[error("unauthorized")]
    Unauthorized,
    #[error("room is still active")]
    RoomStillActive,
    #[error("payment events must be derived from real transfers")]
    PaymentEventDisabled,
}

impl From<RoomError> for ProgramError {
    fn from(error: RoomError) -> Self {
        ProgramError::Custom(error as u32)
    }
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    dispatch_instruction(program_id, accounts, instruction_data)
}

#[inline(never)]
fn dispatch_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() >= 8 {
        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&instruction_data[..8]);
        if discriminator == UNDELEGATE_CALLBACK_DISCRIMINATOR {
            return process_undelegate_callback(program_id, accounts, &instruction_data[8..]);
        }
    }

    let (&tag, payload) = instruction_data
        .split_first()
        .ok_or(RoomError::InvalidInstruction)?;

    match tag {
        TAG_CREATE_ROOM => process_create_room(program_id, accounts, payload),
        TAG_JOIN_ROOM => process_join_room(program_id, accounts),
        TAG_LEAVE_ROOM => process_leave_room(program_id, accounts),
        TAG_SEND_MESSAGE => process_send_message(program_id, accounts, payload),
        TAG_PUSH_PAYMENT_EVENT => process_push_payment_event(program_id, accounts, payload),
        TAG_CLOSE_ROOM => process_close_room(program_id, accounts),
        TAG_DELEGATE_ROOM => process_delegate_room(program_id, accounts),
        TAG_COMMIT_ROOM => process_commit_room(accounts),
        TAG_COMMIT_AND_UNDELEGATE_ROOM => process_commit_and_undelegate_room(accounts),
        _ => Err(RoomError::InvalidInstruction.into()),
    }
}

#[inline(never)]
fn process_create_room(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    payload: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;
    let system_program_account = next_account_info(account_info_iter)?;
    let rent_account = next_account_info(account_info_iter)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if system_program_account.key != &system_program::ID {
        return Err(ProgramError::InvalidAccountData);
    }

    if payload.len() != ROOM_CODE_BYTES {
        return Err(RoomError::InvalidRoomCode.into());
    }

    let mut room_code = [0u8; ROOM_CODE_BYTES];
    room_code.copy_from_slice(payload);

    let (expected_pda, bump) =
        Pubkey::find_program_address(&[ROOM_PROGRAM_SEED, &room_code], program_id);
    if expected_pda != *room_account.key {
        return Err(RoomError::InvalidRoomAccount.into());
    }

    if room_account.owner == program_id && !room_account.data_is_empty() {
        let existing = RoomState::unpack(&room_account.try_borrow_data()?)?;
        if existing.discriminator == ROOM_ACCOUNT_DISCRIMINATOR {
            return Err(RoomError::RoomAlreadyInitialized.into());
        }
    }

    let rent = Rent::from_account_info(rent_account)?;
    let lamports = rent.minimum_balance(ROOM_ACCOUNT_BYTES);
    let create_account_ix = system_instruction::create_account(
        payer.key,
        room_account.key,
        lamports,
        ROOM_ACCOUNT_BYTES as u64,
        program_id,
    );

    invoke_signed(
        &create_account_ix,
        &[payer.clone(), room_account.clone(), system_program_account.clone()],
        &[&[ROOM_PROGRAM_SEED, &room_code, &[bump]]],
    )?;

    let now = Clock::get()?.unix_timestamp;
    let mut room_state = RoomState::default();
    room_state.discriminator = ROOM_ACCOUNT_DISCRIMINATOR;
    room_state.bump = bump;
    room_state.status = STATUS_WAITING;
    room_state.room_code = room_code;
    room_state.creator = payer.key.to_bytes();
    room_state.participant_count = 1;
    room_state.created_at = now;
    room_state.updated_at = now;
    room_state.last_active_at = now;
    room_state.participants[0] = ParticipantSlot {
        wallet: payer.key.to_bytes(),
        connected: 1,
        last_seen_at: now,
    };

    room_state.pack(&mut room_account.try_borrow_mut_data()?)?;
    Ok(())
}

#[inline(never)]
fn process_join_room(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let participant = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;

    if !participant.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let now = Clock::get()?.unix_timestamp;
    let mut room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let wallet_bytes = participant.key.to_bytes();
    if let Some(index) = room_state.find_participant(&wallet_bytes) {
        room_state.participants[index].connected = 1;
        room_state.participants[index].last_seen_at = now;
    } else {
        let empty_index = room_state
            .participants
            .iter()
            .position(|slot| slot.wallet == [0; 32])
            .ok_or(RoomError::RoomFull)?;

        room_state.participants[empty_index] = ParticipantSlot {
            wallet: wallet_bytes,
            connected: 1,
            last_seen_at: now,
        };
        room_state.participant_count = room_state.participant_count.saturating_add(1);
    }

    room_state.updated_at = now;
    room_state.last_active_at = now;
    room_state.refresh_status();
    room_state.pack(&mut room_account.try_borrow_mut_data()?)?;
    Ok(())
}

#[inline(never)]
fn process_leave_room(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let participant = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;

    if !participant.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let now = Clock::get()?.unix_timestamp;
    let mut room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let wallet_bytes = participant.key.to_bytes();
    let index = room_state
        .find_participant(&wallet_bytes)
        .ok_or(RoomError::ParticipantNotFound)?;
    room_state.participants[index].connected = 0;
    room_state.participants[index].last_seen_at = now;
    room_state.updated_at = now;
    room_state.refresh_status();
    room_state.pack(&mut room_account.try_borrow_mut_data()?)?;
    Ok(())
}

fn process_send_message(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    payload: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let participant = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;

    if !participant.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let message_body = parse_sized_utf8(payload, MAX_MESSAGE_BYTES)?;
    let now = Clock::get()?.unix_timestamp;
    let mut room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let wallet_bytes = participant.key.to_bytes();
    let index = room_state
        .find_participant(&wallet_bytes)
        .ok_or(RoomError::ParticipantNotFound)?;

    if room_state.participants[index].connected == 0 {
        return Err(RoomError::ParticipantNotConnected.into());
    }

    room_state.append_message(MessageSlot {
        sender: wallet_bytes,
        sent_at: now,
        body_len: message_body.len() as u16,
        status: 1,
        body: copy_message_bytes(message_body),
    });
    room_state.participants[index].last_seen_at = now;
    room_state.next_message_seq = room_state.next_message_seq.saturating_add(1);
    room_state.updated_at = now;
    room_state.last_active_at = now;
    room_state.refresh_status();
    room_state.pack(&mut room_account.try_borrow_mut_data()?)?;
    Ok(())
}

#[inline(never)]
fn process_push_payment_event(
    _program_id: &Pubkey,
    _accounts: &[AccountInfo],
    _payload: &[u8],
) -> ProgramResult {
    Err(RoomError::PaymentEventDisabled.into())
}

#[inline(never)]
fn process_close_room(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let authority = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;

    if !authority.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let authority_bytes = authority.key.to_bytes();
    let is_creator = room_state.creator == authority_bytes;
    if !is_creator {
        return Err(RoomError::Unauthorized.into());
    }

    if room_state.connected_count() > 1 {
        return Err(RoomError::RoomStillActive.into());
    }

    let destination_starting_lamports = authority.lamports();
    **authority.try_borrow_mut_lamports()? = destination_starting_lamports
        .checked_add(room_account.lamports())
        .ok_or(ProgramError::InvalidAccountData)?;
    **room_account.try_borrow_mut_lamports()? = 0;
    room_account.try_borrow_mut_data()?.fill(0);
    Ok(())
}

#[inline(never)]
fn process_delegate_room(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?;
    let system_program_account = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;
    let owner_program = next_account_info(account_info_iter)?;
    let delegation_buffer = next_account_info(account_info_iter)?;
    let delegation_record = next_account_info(account_info_iter)?;
    let delegation_metadata = next_account_info(account_info_iter)?;
    let delegation_program = next_account_info(account_info_iter)?;
    let validator_account = next_account_info(account_info_iter).ok();

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    if owner_program.key != program_id {
        return Err(RoomError::Unauthorized.into());
    }

    let room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let validator_pubkey = match validator_account {
        Some(account) => *account.key,
        None => DEFAULT_DEVNET_VALIDATOR
            .parse::<Pubkey>()
            .map_err(|_| ProgramError::InvalidArgument)?,
    };

    let room_code_seed = room_state.room_code;
    let bump_seed = [room_state.bump];
    let pda_seeds: &[&[u8]] = &[ROOM_PROGRAM_SEED, &room_code_seed, &bump_seed];

    let delegate_accounts = DelegateAccounts {
        payer,
        pda: room_account,
        owner_program,
        buffer: delegation_buffer,
        delegation_record,
        delegation_metadata,
        delegation_program,
        system_program: system_program_account,
    };

    let delegate_config = DelegateConfig {
        validator: Some(validator_pubkey),
        commit_frequency_ms: 3_000,
        ..Default::default()
    };

    delegate_account(delegate_accounts, pda_seeds, delegate_config)?;
    Ok(())
}

#[inline(never)]
fn process_commit_room(accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;
    let magic_program = next_account_info(account_info_iter)?;
    let magic_context = next_account_info(account_info_iter)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    commit_accounts(payer, vec![room_account], magic_context, magic_program, None)?;
    Ok(())
}

#[inline(never)]
fn process_commit_and_undelegate_room(accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let payer = next_account_info(account_info_iter)?;
    let room_account = next_account_info(account_info_iter)?;
    let magic_program = next_account_info(account_info_iter)?;
    let magic_context = next_account_info(account_info_iter)?;

    if !payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    commit_and_undelegate_accounts(payer, vec![room_account], magic_context, magic_program, None)?;
    Ok(())
}

#[inline(never)]
fn process_undelegate_callback(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    payload: &[u8],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let room_account = next_account_info(account_info_iter)?;
    let delegation_buffer = next_account_info(account_info_iter)?;
    let payer = next_account_info(account_info_iter)?;
    let system_program_account = next_account_info(account_info_iter)?;

    if room_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    let room_state = RoomState::unpack(&room_account.try_borrow_data()?)?;
    ensure_initialized(&room_state)?;

    let pda_seed_values = decode_pda_seeds(payload, &room_state)?;

    undelegate_account(
        room_account,
        program_id,
        delegation_buffer,
        payer,
        system_program_account,
        pda_seed_values,
    )?;

    Ok(())
}

fn ensure_initialized(room_state: &RoomState) -> ProgramResult {
    if room_state.discriminator != ROOM_ACCOUNT_DISCRIMINATOR {
        return Err(RoomError::RoomNotInitialized.into());
    }

    Ok(())
}

fn parse_sized_utf8<'a>(payload: &'a [u8], max_bytes: usize) -> Result<&'a [u8], ProgramError> {
    if payload.len() < 2 {
        return Err(RoomError::InvalidInstruction.into());
    }

    let body_len = u16::from_le_bytes([payload[0], payload[1]]) as usize;
    if body_len > max_bytes || payload.len() < 2 + body_len {
        return Err(RoomError::MessageTooLong.into());
    }

    Ok(&payload[2..2 + body_len])
}

fn copy_message_bytes(message_body: &[u8]) -> [u8; MAX_MESSAGE_BYTES] {
    let mut body = [0u8; MAX_MESSAGE_BYTES];
    body[..message_body.len()].copy_from_slice(message_body);
    body
}

fn decode_pda_seeds(payload: &[u8], room_state: &RoomState) -> Result<Vec<Vec<u8>>, ProgramError> {
    if payload.is_empty() {
        return Ok(vec![
            ROOM_PROGRAM_SEED.to_vec(),
            room_state.room_code.to_vec(),
            vec![room_state.bump],
        ]);
    }

    let mut cursor = 0usize;
    let seed_count = read_u32(payload, &mut cursor)? as usize;
    let mut seeds = Vec::with_capacity(seed_count);

    for _ in 0..seed_count {
        let len = read_u32(payload, &mut cursor)? as usize;
        let end = cursor.saturating_add(len);
        let slice = payload
            .get(cursor..end)
            .ok_or(ProgramError::InvalidInstructionData)?;
        seeds.push(slice.to_vec());
        cursor = end;
    }

    Ok(seeds)
}

impl RoomState {
    fn find_participant(&self, wallet: &[u8; 32]) -> Option<usize> {
        self.participants.iter().position(|slot| &slot.wallet == wallet)
    }

    fn connected_count(&self) -> usize {
        self.participants
            .iter()
            .filter(|slot| slot.wallet != [0; 32] && slot.connected == 1)
            .count()
    }

    fn refresh_status(&mut self) {
        self.status = match self.connected_count() {
            2 => STATUS_ACTIVE,
            0 => STATUS_CLOSED,
            _ => STATUS_WAITING,
        };
    }

    fn append_message(&mut self, message: MessageSlot) {
        if (self.message_count as usize) < MAX_MESSAGES {
            self.messages[self.message_count as usize] = message;
            self.message_count += 1;
            return;
        }

        for index in 1..MAX_MESSAGES {
            self.messages[index - 1] = self.messages[index];
        }
        self.messages[MAX_MESSAGES - 1] = message;
    }

    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        if input.len() < ROOM_ACCOUNT_BYTES {
            return Err(ProgramError::InvalidAccountData);
        }

        let mut cursor = 0usize;
        let discriminator = read_u8(input, &mut cursor)?;
        let bump = read_u8(input, &mut cursor)?;
        let status = read_u8(input, &mut cursor)?;
        let room_code = read_array::<ROOM_CODE_BYTES>(input, &mut cursor)?;
        let creator = read_array::<32>(input, &mut cursor)?;
        let participant_count = read_u8(input, &mut cursor)?;
        let next_message_seq = read_u32(input, &mut cursor)?;
        let message_count = read_u16(input, &mut cursor)?;
        let created_at = read_i64(input, &mut cursor)?;
        let updated_at = read_i64(input, &mut cursor)?;
        let last_active_at = read_i64(input, &mut cursor)?;

        let mut participants = [ParticipantSlot::default(); MAX_PARTICIPANTS];
        for participant in participants.iter_mut() {
            participant.wallet = read_array::<32>(input, &mut cursor)?;
            participant.connected = read_u8(input, &mut cursor)?;
            participant.last_seen_at = read_i64(input, &mut cursor)?;
        }

        let mut messages = [MessageSlot::default(); MAX_MESSAGES];
        for message in messages.iter_mut() {
            message.sender = read_array::<32>(input, &mut cursor)?;
            message.sent_at = read_i64(input, &mut cursor)?;
            message.body_len = read_u16(input, &mut cursor)?;
            message.status = read_u8(input, &mut cursor)?;
            message.body = read_array::<MAX_MESSAGE_BYTES>(input, &mut cursor)?;
        }

        Ok(Self {
            discriminator,
            bump,
            status,
            room_code,
            creator,
            participant_count,
            next_message_seq,
            message_count,
            created_at,
            updated_at,
            last_active_at,
            participants,
            messages,
        })
    }

    fn pack(&self, output: &mut [u8]) -> ProgramResult {
        if output.len() < ROOM_ACCOUNT_BYTES {
            return Err(ProgramError::AccountDataTooSmall);
        }

        let mut cursor = 0usize;
        write_u8(output, &mut cursor, self.discriminator)?;
        write_u8(output, &mut cursor, self.bump)?;
        write_u8(output, &mut cursor, self.status)?;
        write_array(output, &mut cursor, &self.room_code)?;
        write_array(output, &mut cursor, &self.creator)?;
        write_u8(output, &mut cursor, self.participant_count)?;
        write_u32(output, &mut cursor, self.next_message_seq)?;
        write_u16(output, &mut cursor, self.message_count)?;
        write_i64(output, &mut cursor, self.created_at)?;
        write_i64(output, &mut cursor, self.updated_at)?;
        write_i64(output, &mut cursor, self.last_active_at)?;

        for participant in self.participants.iter() {
            write_array(output, &mut cursor, &participant.wallet)?;
            write_u8(output, &mut cursor, participant.connected)?;
            write_i64(output, &mut cursor, participant.last_seen_at)?;
        }

        for message in self.messages.iter() {
            write_array(output, &mut cursor, &message.sender)?;
            write_i64(output, &mut cursor, message.sent_at)?;
            write_u16(output, &mut cursor, message.body_len)?;
            write_u8(output, &mut cursor, message.status)?;
            write_array(output, &mut cursor, &message.body)?;
        }

        Ok(())
    }
}

fn read_u8(input: &[u8], cursor: &mut usize) -> Result<u8, ProgramError> {
    let value = *input.get(*cursor).ok_or(ProgramError::InvalidAccountData)?;
    *cursor += 1;
    Ok(value)
}

fn read_u16(input: &[u8], cursor: &mut usize) -> Result<u16, ProgramError> {
    let bytes = read_slice::<2>(input, cursor)?;
    Ok(u16::from_le_bytes(bytes))
}

fn read_u32(input: &[u8], cursor: &mut usize) -> Result<u32, ProgramError> {
    let bytes = read_slice::<4>(input, cursor)?;
    Ok(u32::from_le_bytes(bytes))
}

fn read_u64(input: &[u8], cursor: &mut usize) -> Result<u64, ProgramError> {
    let bytes = read_slice::<8>(input, cursor)?;
    Ok(u64::from_le_bytes(bytes))
}

fn read_i64(input: &[u8], cursor: &mut usize) -> Result<i64, ProgramError> {
    let bytes = read_slice::<8>(input, cursor)?;
    Ok(i64::from_le_bytes(bytes))
}

fn read_slice<const N: usize>(input: &[u8], cursor: &mut usize) -> Result<[u8; N], ProgramError> {
    let end = cursor.saturating_add(N);
    let slice = input.get(*cursor..end).ok_or(ProgramError::InvalidAccountData)?;
    let mut value = [0u8; N];
    value.copy_from_slice(slice);
    *cursor = end;
    Ok(value)
}

fn read_array<const N: usize>(input: &[u8], cursor: &mut usize) -> Result<[u8; N], ProgramError> {
    read_slice::<N>(input, cursor)
}

fn write_u8(output: &mut [u8], cursor: &mut usize, value: u8) -> ProgramResult {
    write_array(output, cursor, &[value])
}

fn write_u16(output: &mut [u8], cursor: &mut usize, value: u16) -> ProgramResult {
    write_array(output, cursor, &value.to_le_bytes())
}

fn write_u32(output: &mut [u8], cursor: &mut usize, value: u32) -> ProgramResult {
    write_array(output, cursor, &value.to_le_bytes())
}

fn write_u64(output: &mut [u8], cursor: &mut usize, value: u64) -> ProgramResult {
    write_array(output, cursor, &value.to_le_bytes())
}

fn write_i64(output: &mut [u8], cursor: &mut usize, value: i64) -> ProgramResult {
    write_array(output, cursor, &value.to_le_bytes())
}

fn write_array(output: &mut [u8], cursor: &mut usize, value: &[u8]) -> ProgramResult {
    let end = cursor.saturating_add(value.len());
    let target = output
        .get_mut(*cursor..end)
        .ok_or(ProgramError::AccountDataTooSmall)?;
    target.copy_from_slice(value);
    *cursor = end;
    Ok(())
}

#[allow(dead_code)]
fn _log_room_size() {
    msg!("room account bytes: {}", ROOM_ACCOUNT_BYTES);
}
