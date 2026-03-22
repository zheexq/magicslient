"use client";

import { PublicKey } from "@solana/web3.js";
import { appEnv, isMagicBlockConfigured, type RoomTransportMode } from "@/lib/env";
import * as browserStore from "@/lib/mock-room-store";
import type { PaymentEvent, RoomSnapshot } from "@/types/chat";

export type RoomListener = (room: RoomSnapshot | null) => void;

export type RoomClient = {
  mode: RoomTransportMode;
  subscribe: (code: string, listener: RoomListener) => () => void;
  createRoom: (code: string, wallet?: string | null) => Promise<void> | void;
  joinRoom: (code: string, wallet?: string | null) => Promise<void> | void;
  leaveRoom: (code: string, wallet?: string | null) => Promise<void> | void;
  sendMessage: (args: { code: string; body: string; sender: string }) => Promise<void> | void;
  pushPayment: (args: {
    amountSol: number;
    code: string;
    from: string;
    signature?: string;
    status: PaymentEvent["status"];
    to: string;
  }) => Promise<void> | void;
  getDelegationStatus?: (code: string) => Promise<{ isDelegated: boolean; fqdn?: string | null } | null>;
};

async function getMagicBlockClient(): Promise<RoomClient> {
  const { createMagicBlockRoomClient } = await import("@/lib/room-client.magicblock");
  return createMagicBlockRoomClient();
}

function getBrowserClient(): RoomClient {
  return {
    mode: "browser",
    subscribe: browserStore.subscribeToRoom,
    createRoom: async (code, wallet) => {
      browserStore.createRoom(code, wallet);
    },
    joinRoom: async (code, wallet) => {
      browserStore.joinRoom(code, wallet);
    },
    leaveRoom: async (code, wallet) => {
      browserStore.leaveRoom(code, wallet);
    },
    sendMessage: async ({ body, code, sender }) => {
      browserStore.sendMessage({ body, code, sender });
    },
    pushPayment: async (args) => {
      browserStore.addPaymentEvent(args);
    },
  };
}

let cachedClient: RoomClient | null = null;

export async function getRoomClient() {
  if (cachedClient) {
    return cachedClient;
  }

  if (appEnv.roomTransport === "magicblock" && isMagicBlockConfigured()) {
    cachedClient = await getMagicBlockClient();
    return cachedClient;
  }

  cachedClient = getBrowserClient();
  return cachedClient;
}

export function getRoomTransportSummary() {
  if (appEnv.roomTransport === "magicblock" && isMagicBlockConfigured()) {
    return {
      mode: "magicblock" as const,
      detail: `MagicBlock router ${appEnv.magicRouterHttpUrl}`,
      roomProgramId: new PublicKey(appEnv.roomProgramId).toBase58(),
    };
  }

  return {
    mode: "browser" as const,
    detail: "Browser-only sessionStorage + BroadcastChannel fallback",
    roomProgramId: null,
  };
}
