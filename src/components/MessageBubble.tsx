"use client";

import type { ChatMessage } from "@/types/chat";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MessageBubble({
  isSelf,
  label,
  message,
}: {
  isSelf: boolean;
  label: string;
  message: ChatMessage;
}) {
  return (
    <div className={cn("flex w-full", isSelf ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[82%] rounded-3xl border px-4 py-3",
          isSelf
            ? "border-accent/20 bg-accent text-slate-950"
            : "border-line bg-panelSoft text-slate-50",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.24em]">
          <span className={cn(isSelf ? "text-slate-900/70" : "text-slate-400")}>{label}</span>
          <span className={cn(isSelf ? "text-slate-900/60" : "text-slate-500")}>
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>
        <p className="text-sm leading-6">{message.body}</p>
      </div>
    </div>
  );
}
