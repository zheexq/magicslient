"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useAppWallet } from "@/components/AppProviders";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { createRoomCode } from "@/lib/identity";
import { getRoomClient } from "@/lib/room-client";

export default function RoomLobbyPage() {
  const router = useRouter();
  const wallet = useAppWallet();
  const walletAddress = wallet.walletAddress;
  const [code, setCode] = useState("");

  async function handleCreateRoom() {
    const nextCode = createRoomCode();
    const client = await getRoomClient();
    await client.createRoom(nextCode, walletAddress);
    router.push(`/room/${nextCode}`);
  }

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCode = code.trim().toUpperCase();
    if (!nextCode) {
      return;
    }

    router.push(`/room/${nextCode}`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-noise px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-24 h-52 w-52 rounded-full bg-accent/12 blur-3xl" />
        <div className="absolute bottom-16 right-[14%] h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col rounded-[40px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-glow backdrop-blur-xl sm:p-6">
        <header className="flex flex-col gap-5 rounded-[32px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] p-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-white/5 px-3 py-1.5 text-[11px] uppercase tracking-[0.28em] text-accentSoft transition hover:bg-white/8"
            >
              Back home
            </Link>
            <h1 className="mt-5 bg-[linear-gradient(180deg,#ffffff_0%,#d8b4fe_100%)] bg-clip-text py-1 text-4xl font-semibold leading-[1.1] tracking-tight text-transparent sm:text-5xl sm:leading-[1.08]">
              Enter MagicSlient
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Create a clean private room or join one in seconds. Wallet-only, anonymous, no baggage.
            </p>
          </div>
          <WalletConnectButton />
        </header>

        <section className="mt-6 grid flex-1 gap-5 md:grid-cols-2">
          <div className="rounded-[32px] bg-white/4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">Create room</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Start a fresh room</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Generate a new ephemeral code and drop directly into the chat interface with your share link ready.
            </p>
            <button
              type="button"
              onClick={handleCreateRoom}
              className="mt-8 inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#c084fc_0%,#a855f7_55%,#9333ea_100%)] px-6 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.32)] transition hover:scale-[1.01] hover:brightness-110"
            >
              Create room
            </button>
          </div>

          <div className="rounded-[32px] bg-white/4 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">Join room</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Enter a code</h2>
            <form onSubmit={handleJoinRoom} className="mt-5 space-y-4">
              <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(0,0,0,0.08))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <div className="rounded-[18px] bg-black/24 px-4 py-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">Room code</p>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Enter code, for example 15LM42"
                    className="h-7 w-full bg-transparent text-sm uppercase tracking-[0.24em] text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white/5 px-6 text-sm font-medium text-slate-100 transition hover:bg-white/8"
              >
                Join room
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
