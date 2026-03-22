"use client";

import { useState } from "react";
import { useAppWallet } from "@/components/AppProviders";

export function WalletConnectButton() {
  const wallet = useAppWallet();
  const [open, setOpen] = useState(false);

  if (wallet.connected) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-11 rounded-full border border-line bg-panelSoft px-4 text-sm text-slate-100 transition hover:bg-panel"
        >
          {wallet.walletLabel ?? "Wallet"} {wallet.walletAddress?.slice(0, 4)}...{wallet.walletAddress?.slice(-4)}
        </button>

        {open ? (
          <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[220px] rounded-3xl border border-white/8 bg-[#120d1d]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void wallet.disconnect();
              }}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/5"
            >
              <span>Disconnect</span>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{wallet.walletLabel}</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={wallet.connecting}
        className="h-11 rounded-full border border-line bg-panelSoft px-4 text-sm text-slate-100 transition hover:bg-panel disabled:opacity-50"
      >
        {wallet.connecting ? "Connecting..." : "Connect wallet"}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 min-w-[260px] rounded-3xl border border-white/8 bg-[#120d1d]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="px-3 pb-2 pt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">Choose wallet</div>
          <div className="space-y-1">
            {wallet.availableWallets.map((option) =>
              option.installed ? (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void wallet.connect(option.id);
                  }}
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-100 transition hover:bg-white/5"
                >
                  <span>{option.label}</span>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                    Installed
                  </span>
                </button>
              ) : (
                <a
                  key={option.id}
                  href={option.installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
                >
                  <span>{option.label}</span>
                  <span className="rounded-full bg-white/6 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Install
                  </span>
                </a>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
