export type RoomStatus = "waiting" | "active" | "closed";

export type ParticipantRole = "A" | "B";

export type Participant = {
  wallet: string;
  role: ParticipantRole;
  connected: boolean;
  lastSeenAt: number;
};

export type ChatMessage = {
  id: string;
  roomCode: string;
  sender: string;
  body: string;
  createdAt: number;
  status: "sent" | "pending" | "failed";
};

export type PaymentEvent = {
  id: string;
  signature?: string;
  roomCode: string;
  from: string;
  to: string;
  amountSol: number;
  createdAt: number;
  status: "pending" | "confirmed" | "failed";
};

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  participants: Participant[];
  messages: ChatMessage[];
  payments: PaymentEvent[];
};
