import { PublicKey } from "@solana/web3.js";
import type { ChatMessage, Participant, RoomSnapshot } from "@/types/chat";

const ROOM_CODE_BYTES = 6;
const MAX_PARTICIPANTS = 2;
const MAX_MESSAGES = 1;
const MAX_MESSAGE_BYTES = 48;

const PARTICIPANT_SLOT_BYTES = 32 + 1 + 8;
const MESSAGE_SLOT_BYTES = 32 + 8 + 2 + 1 + MAX_MESSAGE_BYTES;

const asciiDecoder = new TextDecoder("ascii");
const utf8Decoder = new TextDecoder("utf-8");

function readBytes(view: Uint8Array, offset: number, size: number) {
  return view.slice(offset, offset + size);
}

function readFixedString(view: Uint8Array, offset: number, size: number) {
  return asciiDecoder
    .decode(readBytes(view, offset, size))
    .replace(/\0/g, "")
    .trim();
}

function readPublicKey(view: Uint8Array, offset: number) {
  const bytes = readBytes(view, offset, 32);
  if (bytes.every((value) => value === 0)) {
    return null;
  }

  return new PublicKey(bytes).toBase58();
}

function readI64(dataView: DataView, offset: number) {
  return Number(dataView.getBigInt64(offset, true));
}

function statusFromByte(value: number): RoomSnapshot["status"] {
  if (value === 1) {
    return "active";
  }

  if (value === 2) {
    return "closed";
  }

  return "waiting";
}
export function decodeRoomAccount(code: string, raw: Buffer | Uint8Array) {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let offset = 0;
  const discriminator = bytes[offset];
  offset += 1;

  if (discriminator !== 1) {
    return null;
  }

  offset += 1; // bump
  const status = statusFromByte(bytes[offset]);
  offset += 1;

  const roomCode = readFixedString(bytes, offset, ROOM_CODE_BYTES) || code;
  offset += ROOM_CODE_BYTES;

  const creator = readPublicKey(bytes, offset);
  offset += 32;

  const participantCount = bytes[offset];
  offset += 1;

  offset += 4; // next_message_seq
  const messageCount = dataView.getUint16(offset, true);
  offset += 2;

  const createdAt = readI64(dataView, offset) * 1000;
  offset += 8;
  const updatedAt = readI64(dataView, offset) * 1000;
  offset += 8;
  const lastActiveAt = readI64(dataView, offset) * 1000;
  offset += 8;

  const participants: Participant[] = [];
  for (let index = 0; index < MAX_PARTICIPANTS; index += 1) {
    const wallet = readPublicKey(bytes, offset);
    offset += 32;
    const connected = bytes[offset] === 1;
    offset += 1;
    const lastSeenAt = readI64(dataView, offset) * 1000;
    offset += 8;

    if (!wallet) {
      continue;
    }

    participants.push({
      wallet,
      role: index === 0 ? "A" : "B",
      connected,
      lastSeenAt,
    });
  }

  const messages: ChatMessage[] = [];
  for (let index = 0; index < MAX_MESSAGES; index += 1) {
    const sender = readPublicKey(bytes, offset);
    offset += 32;
    const sentAt = readI64(dataView, offset) * 1000;
    offset += 8;
    const bodyLen = dataView.getUint16(offset, true);
    offset += 2;
    offset += 1; // message status
    const body = utf8Decoder.decode(readBytes(bytes, offset, bodyLen));
    offset += MAX_MESSAGE_BYTES;

    if (!sender || index >= messageCount) {
      continue;
    }

    messages.push({
      id: `${roomCode}-msg-${index}-${sentAt}`,
      roomCode,
      sender,
      body,
      createdAt: sentAt,
      status: "sent",
    });
  }

  const payments: RoomSnapshot["payments"] = [];

  return {
    code: roomCode,
    status,
    createdAt,
    updatedAt: updatedAt || lastActiveAt,
    expiresAt: lastActiveAt + 1000 * 60 * 60 * 3,
    participants: participants.slice(0, participantCount || MAX_PARTICIPANTS),
    messages,
    payments,
  } satisfies RoomSnapshot;
}
