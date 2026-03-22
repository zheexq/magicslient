"use client";

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { appEnv } from "@/lib/env";
import * as browserStore from "@/lib/mock-room-store";
import { decodeRoomAccount } from "@/lib/room-account";
import {
  buildCreateRoomInstruction,
  buildJoinRoomInstruction,
  buildLeaveRoomInstruction,
  buildSendMessageInstruction,
  deriveRoomPda,
} from "@/lib/room-program";
import type { RoomClient } from "@/lib/room-client";

type DelegationResponse = {
  result?: {
    isDelegated?: boolean;
    fqdn?: string;
  };
};

type InjectedSolanaProvider = {
  publicKey?: PublicKey;
  connect?: () => Promise<{ publicKey: PublicKey }>;
  signAndSendTransaction?: (transaction: Transaction) => Promise<{ signature: string }>;
};

function getProgramId() {
  return new PublicKey(appEnv.roomProgramId);
}

function getRouterConnection() {
  return new Connection(appEnv.magicRouterHttpUrl, "confirmed");
}

function deriveCodeState(code: string) {
  const programId = getProgramId();
  const [roomPda] = deriveRoomPda(code, programId);
  return { programId, roomPda };
}

async function sendWalletTransaction({
  instruction,
  wallet,
}: {
  instruction: TransactionInstruction;
  wallet: string;
}) {
  if (typeof window === "undefined") {
    throw new Error("Wallet transport is only available in the browser.");
  }

  const scopedWindow = window as Window & {
    solana?: InjectedSolanaProvider & { isPhantom?: boolean; isMagicEden?: boolean; isMetaMask?: boolean };
    phantom?: { solana?: InjectedSolanaProvider };
    okxwallet?: InjectedSolanaProvider & { solana?: InjectedSolanaProvider; isOkxWallet?: boolean };
    magicEden?: { solana?: InjectedSolanaProvider };
  };

  const candidates: Array<InjectedSolanaProvider | null | undefined> = [
    scopedWindow.phantom?.solana,
    scopedWindow.okxwallet?.solana,
    scopedWindow.okxwallet,
    scopedWindow.magicEden?.solana,
    scopedWindow.solana,
  ];
  const provider =
    candidates.find(
      (candidate) =>
        candidate?.publicKey?.toBase58() === wallet && typeof candidate.signAndSendTransaction === "function",
    ) ?? null;

  if (!provider?.signAndSendTransaction || !provider.publicKey) {
    throw new Error("Connect a supported Solana wallet to use MagicBlock transport.");
  }

  if (provider.publicKey.toBase58() !== wallet) {
    throw new Error("Connected Phantom wallet does not match the room wallet.");
  }

  const connection = getRouterConnection();
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = provider.publicKey;
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const response = await provider.signAndSendTransaction(transaction);
  await connection.confirmTransaction(
    {
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: response.signature,
    },
    "confirmed",
  );

  return response.signature;
}

async function fetchDelegationStatus(roomPda: PublicKey) {
  const response = await fetch(`${appEnv.magicRouterHttpUrl}/getDelegationStatus`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getDelegationStatus",
      params: [roomPda.toBase58()],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as DelegationResponse;
  return {
    fqdn: payload.result?.fqdn ?? null,
    isDelegated: Boolean(payload.result?.isDelegated),
  };
}

export function createMagicBlockRoomClient(): RoomClient {
  return {
    mode: "magicblock",
    subscribe: (code, listener) => {
      const connection = getRouterConnection();
      const { roomPda } = deriveCodeState(code);
      const fallbackCleanup = browserStore.subscribeToRoom(code, listener);
      let subscriptionId = 0;

      connection
        .getAccountInfo(roomPda, "confirmed")
        .then((accountInfo) => {
          if (accountInfo?.data) {
            listener(decodeRoomAccount(code, accountInfo.data) ?? browserStore.peekRoom(code));
            return;
          }

          listener(browserStore.peekRoom(code));
        })
        .catch(() => undefined);

      subscriptionId = connection.onAccountChange(
        roomPda,
        (accountInfo) => {
          listener(decodeRoomAccount(code, accountInfo.data) ?? browserStore.peekRoom(code));
        },
        "confirmed",
      );

      return () => {
        fallbackCleanup();
        void connection.removeAccountChangeListener(subscriptionId);
      };
    },
    createRoom: async (code, wallet) => {
      if (!wallet) {
        browserStore.createRoom(code, wallet);
        return;
      }

      const { programId, roomPda } = deriveCodeState(code);
      browserStore.createRoom(code, wallet);
      const instruction = buildCreateRoomInstruction({
        code,
        payer: new PublicKey(wallet),
        programId,
        roomPda,
      });
      await sendWalletTransaction({ instruction, wallet });
    },
    joinRoom: async (code, wallet) => {
      browserStore.joinRoom(code, wallet);
      if (!wallet) {
        return;
      }

      const { programId, roomPda } = deriveCodeState(code);
      const instruction = buildJoinRoomInstruction({
        participant: new PublicKey(wallet),
        programId,
        roomPda,
      });
      await sendWalletTransaction({ instruction, wallet });
    },
    leaveRoom: async (code, wallet) => {
      browserStore.leaveRoom(code, wallet);
      if (!wallet) {
        return;
      }

      const { programId, roomPda } = deriveCodeState(code);
      const instruction = buildLeaveRoomInstruction({
        participant: new PublicKey(wallet),
        programId,
        roomPda,
      });
      await sendWalletTransaction({ instruction, wallet });
    },
    sendMessage: async ({ body, code, sender }) => {
      browserStore.sendMessage({ body, code, sender });
      const { programId, roomPda } = deriveCodeState(code);
      const instruction = buildSendMessageInstruction({
        body,
        participant: new PublicKey(sender),
        programId,
        roomPda,
      });
      await sendWalletTransaction({ instruction, wallet: sender });
    },
    pushPayment: async ({ amountSol, code, from, signature, status, to }) => {
      if (status !== "confirmed" || !signature) {
        return;
      }

      browserStore.addPaymentEvent({
        amountSol,
        code,
        from,
        signature,
        status,
        to,
      });
    },
    getDelegationStatus: async (code) => {
      const { roomPda } = deriveCodeState(code);
      return fetchDelegationStatus(roomPda);
    },
  };
}
