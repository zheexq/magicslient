import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

export const ROOM_PROGRAM_SEED = "room";
export const MAX_MESSAGE_BYTES = 160;
export const ROOM_CODE_BYTES = 6;
export const MAGICBLOCK_UNDELEGATE_CALLBACK_DISCRIMINATOR = Uint8Array.from([
  196, 28, 41, 206, 48, 37, 51, 167,
]);

export enum RoomInstructionTag {
  CreateRoom = 0,
  JoinRoom = 1,
  LeaveRoom = 2,
  SendMessage = 3,
  PushPaymentEvent = 4,
  CloseRoom = 5,
  DelegateRoom = 6,
  CommitRoom = 7,
  CommitAndUndelegateRoom = 8,
}

function encodeFixedAscii(value: string, size: number) {
  const normalized = value.trim().toUpperCase().slice(0, size);
  const buffer = Buffer.alloc(size);
  buffer.write(normalized, "ascii");
  return buffer;
}

function encodeUtf8WithLength(value: string, maxBytes: number) {
  const content = Buffer.from(value.trim(), "utf8").subarray(0, maxBytes);
  const buffer = Buffer.alloc(2 + content.length);
  buffer.writeUInt16LE(content.length, 0);
  content.copy(buffer, 2);
  return buffer;
}

export function deriveRoomPda(code: string, programId: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(ROOM_PROGRAM_SEED), encodeFixedAscii(code, ROOM_CODE_BYTES)],
    programId,
  );
}

export function buildCreateRoomInstruction({
  code,
  payer,
  programId,
  roomPda,
}: {
  code: string;
  payer: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  const data = Buffer.concat([
    Buffer.from([RoomInstructionTag.CreateRoom]),
    encodeFixedAscii(code, ROOM_CODE_BYTES),
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildJoinRoomInstruction({
  participant,
  programId,
  roomPda,
}: {
  participant: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: participant, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([RoomInstructionTag.JoinRoom]),
  });
}

export function buildLeaveRoomInstruction({
  participant,
  programId,
  roomPda,
}: {
  participant: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: participant, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([RoomInstructionTag.LeaveRoom]),
  });
}

export function buildSendMessageInstruction({
  body,
  participant,
  programId,
  roomPda,
}: {
  body: string;
  participant: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  const data = Buffer.concat([
    Buffer.from([RoomInstructionTag.SendMessage]),
    encodeUtf8WithLength(body, MAX_MESSAGE_BYTES),
  ]);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: participant, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function buildCloseRoomInstruction({
  authority,
  programId,
  roomPda,
}: {
  authority: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([RoomInstructionTag.CloseRoom]),
  });
}

export function buildDelegateRoomInstruction({
  delegationBuffer,
  delegationMetadata,
  delegationProgram,
  delegationRecord,
  ownerProgram,
  payer,
  programId,
  roomPda,
  systemProgram = SystemProgram.programId,
  validator,
}: {
  delegationBuffer: PublicKey;
  delegationMetadata: PublicKey;
  delegationProgram: PublicKey;
  delegationRecord: PublicKey;
  ownerProgram: PublicKey;
  payer: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
  systemProgram?: PublicKey;
  validator?: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: ownerProgram, isSigner: false, isWritable: false },
      { pubkey: delegationBuffer, isSigner: false, isWritable: true },
      { pubkey: delegationRecord, isSigner: false, isWritable: true },
      { pubkey: delegationMetadata, isSigner: false, isWritable: true },
      { pubkey: delegationProgram, isSigner: false, isWritable: false },
      ...(validator ? [{ pubkey: validator, isSigner: false, isWritable: false }] : []),
    ],
    data: Buffer.from([RoomInstructionTag.DelegateRoom]),
  });
}

export function buildCommitRoomInstruction({
  magicContext,
  magicProgram,
  payer,
  programId,
  roomPda,
}: {
  magicContext: PublicKey;
  magicProgram: PublicKey;
  payer: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: magicProgram, isSigner: false, isWritable: false },
      { pubkey: magicContext, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([RoomInstructionTag.CommitRoom]),
  });
}

export function buildCommitAndUndelegateRoomInstruction({
  magicContext,
  magicProgram,
  payer,
  programId,
  roomPda,
}: {
  magicContext: PublicKey;
  magicProgram: PublicKey;
  payer: PublicKey;
  programId: PublicKey;
  roomPda: PublicKey;
}) {
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: roomPda, isSigner: false, isWritable: true },
      { pubkey: magicProgram, isSigner: false, isWritable: false },
      { pubkey: magicContext, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([RoomInstructionTag.CommitAndUndelegateRoom]),
  });
}
