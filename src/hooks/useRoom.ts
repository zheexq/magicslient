"use client";

import { useEffect, useState } from "react";
import { getRoomClient } from "@/lib/room-client";
import type { PaymentEvent, RoomSnapshot } from "@/types/chat";

export function useRoom(code: string, wallet?: string | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [transportMode, setTransportMode] = useState<"browser" | "magicblock">("browser");
  const [delegation, setDelegation] = useState<{ isDelegated: boolean; fqdn?: string | null } | null>(null);
  const [transportError, setTransportError] = useState<string>("");

  useEffect(() => {
    let disposed = false;
    let cleanup: () => void = () => {};

    void (async () => {
      const client = await getRoomClient();
      if (disposed) {
        return;
      }

      setTransportMode(client.mode);
      cleanup = client.subscribe(code, setRoom);

      if (client.getDelegationStatus) {
        try {
          const status = await client.getDelegationStatus(code);
          if (!disposed) {
            setDelegation(status);
          }
        } catch (error) {
          if (!disposed) {
            setTransportError(error instanceof Error ? error.message : "Failed to read delegation status.");
          }
        }
      }
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [code]);

  useEffect(() => {
    if (!wallet) {
      return;
    }

    let disposed = false;

    void (async () => {
      const client = await getRoomClient();
      setTransportMode(client.mode);
      try {
        if (!room) {
          await client.createRoom(code, wallet);
        } else {
          await client.joinRoom(code, wallet);
        }
      } catch (error) {
        if (!disposed) {
          setTransportError(error instanceof Error ? error.message : "Failed to join room.");
        }
      }
    })();

    return () => {
      disposed = true;
      void (async () => {
        const client = await getRoomClient();
        await client.leaveRoom(code, wallet);
      })();
    };
  }, [code, room, wallet]);

  return {
    delegation,
    transportError,
    transportMode,
    room,
    postMessage: async (body: string) => {
      if (!wallet) {
        throw new Error("Connect a wallet to chat.");
      }

      const client = await getRoomClient();
      await client.sendMessage({ code, body, sender: wallet });
    },
    pushPayment: async (payment: {
      amountSol: number;
      signature?: string;
      status: PaymentEvent["status"];
      to: string;
    }) => {
      if (!wallet) {
        throw new Error("Connect a wallet first.");
      }

      const client = await getRoomClient();
      await client.pushPayment({
        amountSol: payment.amountSol,
        code,
        from: wallet,
        signature: payment.signature,
        status: payment.status,
        to: payment.to,
      });
    },
  };
}
