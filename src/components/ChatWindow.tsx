"use client";

import { useMemo } from "react";
import type { PaymentEvent, RoomSnapshot } from "@/types/chat";
import { MessageBubble } from "@/components/MessageBubble";
import { formatRelativeTime } from "@/lib/utils";
import { shortWallet } from "@/lib/identity";

function PaymentChip({
  currentWallet,
  event,
}: {
  currentWallet?: string | null;
  event: PaymentEvent;
}) {
  const isSelf = currentWallet === event.from;

  return (
    <div className="mx-auto w-fit rounded-full border border-line bg-panel px-3 py-2 text-xs text-slate-300">
      <span>{isSelf ? `You sent ${event.amountSol} SOL` : `Peer sent ${event.amountSol} SOL`}</span>
      <span className="ml-2 text-slate-500">{formatRelativeTime(event.createdAt)}</span>
    </div>
  );
}

export function ChatWindow({
  currentWallet,
  room,
}: {
  currentWallet?: string | null;
  room: RoomSnapshot | null;
}) {
  const peerWallet = room?.participants.find((participant) => participant.wallet !== currentWallet)?.wallet ?? null;
  const timeline = useMemo(() => {
    if (!room) {
      return [];
    }

    return [
      ...room.messages.map((message) => ({
        type: "message" as const,
        createdAt: message.createdAt,
        id: message.id,
        message,
      })),
      ...room.payments.map((event) => ({
        type: "payment" as const,
        createdAt: event.createdAt,
        id: event.id,
        event,
      })),
    ].sort((left, right) => left.createdAt - right.createdAt);
  }, [room]);

  if (!room) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-[32px] border border-dashed border-line bg-panel/60 px-6 text-center text-sm text-slate-400">
        Waiting for a room snapshot. Open the same room in another tab to simulate the duel flow quickly.
      </div>
    );
  }

  return (
    <div className="flex min-h-[360px] flex-col gap-4 rounded-[32px] border border-line bg-panel/90 p-4">
      <div className="flex items-center justify-between border-b border-line/80 pb-4 text-xs uppercase tracking-[0.24em] text-slate-500">
        <span>{room.status === "active" ? "Live duel" : "Waiting room"}</span>
        <span>{peerWallet ? shortWallet(peerWallet) : "Peer pending"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {timeline.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
            No history is persisted. Messages disappear when both players leave.
          </div>
        ) : null}

        {timeline.map((item) =>
          item.type === "message" ? (
            <MessageBubble
              key={item.id}
              isSelf={item.message.sender === currentWallet}
              label={
                item.message.sender === currentWallet ? "You" : peerWallet ? `Peer (${shortWallet(peerWallet)})` : "Peer"
              }
              message={item.message}
            />
          ) : (
            <PaymentChip key={item.id} currentWallet={currentWallet} event={item.event} />
          ),
        )}
      </div>
    </div>
  );
}
