"use client";

import { useState } from "react";

const QUICK_AMOUNTS = [0.01, 0.05, 0.1];

export function SendSOLButton({
  busy,
  disabled,
  onSend,
}: {
  busy?: boolean;
  disabled?: boolean;
  onSend: (amount: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");

  const parsedAmount = Number(customAmount);
  const isCustomAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => setOpen((current) => !current)}
        className="h-11 rounded-full border border-line bg-panelSoft px-4 text-sm font-medium text-slate-200 transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending..." : "Send SOL"}
      </button>

      {open ? (
        <div className="absolute bottom-14 right-0 flex min-w-[260px] flex-col gap-3 rounded-3xl border border-line bg-panel p-3 shadow-glow">
          <p className="px-1 text-xs uppercase tracking-[0.22em] text-slate-500">Quick send</p>
          {QUICK_AMOUNTS.map((amount) => (
            <button
              key={amount}
              type="button"
              disabled={busy}
              onClick={async () => {
                await onSend(amount);
                setOpen(false);
              }}
              className="rounded-2xl border border-line bg-panelSoft px-3 py-3 text-left text-sm text-slate-100 transition hover:border-accent/30 hover:bg-[#261942]"
            >
              {amount} SOL
            </button>
          ))}

          <div className="mt-1 rounded-2xl bg-black/15 p-2">
            <p className="px-2 pb-2 text-xs uppercase tracking-[0.22em] text-slate-500">Custom amount</p>
            <div className="flex items-center gap-2">
              <input
                value={customAmount}
                onChange={(event) => setCustomAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0.25"
                className="h-11 flex-1 rounded-2xl bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <button
                type="button"
                disabled={busy || !isCustomAmountValid}
                onClick={async () => {
                  await onSend(parsedAmount);
                  setCustomAmount("");
                  setOpen(false);
                }}
                className="h-11 rounded-2xl bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
