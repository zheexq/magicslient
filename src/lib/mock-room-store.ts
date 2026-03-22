"use client";

import type { ChatMessage, Participant, PaymentEvent, RoomSnapshot } from "@/types/chat";

const STORAGE_PREFIX = "anonymous-duel-chat:room:";
const EXPIRY_MS = 1000 * 60 * 15;

type Listener = (room: RoomSnapshot | null) => void;

function key(code: string) {
  return `${STORAGE_PREFIX}${code}`;
}

function roomChannel(code: string) {
  return `anonymous-duel-chat:${code}`;
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function now() {
  return Date.now();
}

function loadRoom(code: string) {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(key(code));
  if (!raw) {
    return null;
  }

  let parsed: RoomSnapshot;
  try {
    parsed = JSON.parse(raw) as RoomSnapshot;
  } catch {
    storage.removeItem(key(code));
    return null;
  }

  if (parsed.expiresAt < now()) {
    storage.removeItem(key(code));
    return null;
  }

  return parsed;
}

export function peekRoom(code: string) {
  return loadRoom(code);
}

function saveRoom(room: RoomSnapshot) {
  const storage = getStorage();
  if (!storage) {
    return room;
  }

  const snapshot = {
    ...room,
    updatedAt: now(),
    expiresAt: now() + EXPIRY_MS,
  };
  storage.setItem(key(room.code), JSON.stringify(snapshot));
  return snapshot;
}

function publish(code: string, room: RoomSnapshot | null) {
  const channel = new BroadcastChannel(roomChannel(code));
  channel.postMessage(room);
  channel.close();
}

function sync(code: string, recipe: (room: RoomSnapshot | null) => RoomSnapshot | null) {
  const storage = getStorage();
  const next = recipe(loadRoom(code));
  if (next) {
    const saved = saveRoom(next);
    publish(code, saved);
    return saved;
  }

  storage?.removeItem(key(code));
  publish(code, null);
  return null;
}

export function createRoom(code: string, wallet?: string | null) {
  const participants = wallet
    ? [
        {
          wallet,
          role: "A" as const,
          connected: true,
          lastSeenAt: now(),
        },
      ]
    : [];

  const room: RoomSnapshot = {
    code,
    status: "waiting",
    createdAt: now(),
    updatedAt: now(),
    expiresAt: now() + EXPIRY_MS,
    participants,
    messages: [],
    payments: [],
  };

  return saveRoom(room);
}

export function joinRoom(code: string, wallet?: string | null) {
  return sync(code, (current) => {
    if (!current || current.status === "closed") {
      return current;
    }

    const alreadyInRoom = current.participants.find((participant) => participant.wallet === wallet);
    if (alreadyInRoom) {
      return {
        ...current,
        participants: current.participants.map((participant) =>
          participant.wallet === wallet
            ? { ...participant, connected: true, lastSeenAt: now() }
            : participant,
        ),
      };
    }

    if (!wallet || current.participants.length >= 2) {
      return current;
    }

    const participant: Participant = {
      wallet,
      role: current.participants.length === 0 ? "A" : "B",
      connected: true,
      lastSeenAt: now(),
    };

    return {
      ...current,
      status: current.participants.length === 1 ? "active" : "waiting",
      participants: [...current.participants, participant],
    };
  });
}

export function leaveRoom(code: string, wallet?: string | null) {
  return sync(code, (current) => {
    if (!current || !wallet) {
      return current;
    }

    const participants = current.participants.map((participant) =>
      participant.wallet === wallet
        ? { ...participant, connected: false, lastSeenAt: now() }
        : participant,
    );

    const stillConnected = participants.some((participant) => participant.connected);

    if (!stillConnected) {
      return null;
    }

    return {
      ...current,
      status: participants.filter((participant) => participant.connected).length === 2 ? "active" : "waiting",
      participants,
    };
  });
}

export function sendMessage({
  code,
  body,
  sender,
}: {
  code: string;
  body: string;
  sender: string;
}) {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    roomCode: code,
    sender,
    body,
    createdAt: now(),
    status: "sent",
  };

  return sync(code, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      messages: [...current.messages, message].slice(-40),
    };
  });
}

export function addPaymentEvent({
  amountSol,
  code,
  from,
  signature,
  status,
  to,
}: {
  amountSol: number;
  code: string;
  from: string;
  signature?: string;
  status: PaymentEvent["status"];
  to: string;
}) {
  const payment: PaymentEvent = {
    id: crypto.randomUUID(),
    signature,
    roomCode: code,
    from,
    to,
    amountSol,
    createdAt: now(),
    status,
  };

  return sync(code, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      payments: [...current.payments, payment].slice(-20),
    };
  });
}

export function subscribeToRoom(code: string, listener: Listener) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  listener(loadRoom(code));

  const channel = new BroadcastChannel(roomChannel(code));
  const onStorage = (event: StorageEvent) => {
    if (event.key === key(code)) {
      listener(loadRoom(code));
    }
  };

  channel.onmessage = (event) => listener(event.data as RoomSnapshot | null);
  window.addEventListener("storage", onStorage);

  return () => {
    channel.close();
    window.removeEventListener("storage", onStorage);
  };
}
