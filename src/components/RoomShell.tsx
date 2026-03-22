"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppWallet } from "@/components/AppProviders";
import { ChatWindow } from "@/components/ChatWindow";
import { InputBox } from "@/components/InputBox";
import { SendSOLButton } from "@/components/SendSOLButton";
import { WalletConnectButton } from "@/components/WalletConnectButton";
import { useRoom } from "@/hooks/useRoom";
import { sendSolPayment } from "@/lib/payments";
import { shortWallet } from "@/lib/identity";
import { getRoomTransportSummary } from "@/lib/room-client";

export function RoomShell({ code }: { code: string }) {
  const router = useRouter();
  const wallet = useAppWallet();
  const walletAddress = wallet.walletAddress;
  const { delegation, postMessage, pushPayment, room, transportError, transportMode } = useRoom(
    code,
    walletAddress,
  );
  const [paymentState, setPaymentState] = useState("");
  const transport = getRoomTransportSummary();
  const modeLabel = transportMode === "magicblock" ? "MagicBlock ER" : "Local preview";
  const delegationLabel =
    transportMode === "magicblock"
      ? delegation
        ? delegation.isDelegated
          ? "Live"
          : "Pending"
        : "Checking"
      : "Ready";
  const programLabel = transportMode === "magicblock" && transport.roomProgramId ? "Connected" : "Preview";

  const peerWallet = room?.participants.find((participant) => participant.wallet !== walletAddress)?.wallet ?? null;

  async function handleSendPayment(amount: number) {
    if (!walletAddress || !peerWallet) {
      setPaymentState("Connect wallet and wait for your peer before sending SOL.");
      return;
    }

    try {
      setPaymentState("Waiting for wallet approval...");
      const signature = await sendSolPayment({
        amountSol: amount,
        recipient: peerWallet,
        wallet,
      });
      await pushPayment({
        amountSol: amount,
        signature,
        status: "confirmed",
        to: peerWallet,
      });
      setPaymentState(`Sent ${amount} SOL to ${shortWallet(peerWallet)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed.";
      setPaymentState(message);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-noise px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-24 h-56 w-56 rounded-full bg-accent/12 blur-3xl" />
        <div className="absolute bottom-12 right-[10%] h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-5 rounded-[40px] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 shadow-glow backdrop-blur-xl sm:p-6">
        <header className="flex flex-col gap-4 rounded-[30px] bg-white/4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className="bg-[linear-gradient(180deg,#f5e8ff_0%,#d8b4fe_100%)] bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-[2.15rem]"
            >
              MagicSlient
            </Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Room {code}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              A focused 1v1 room with instant chat, quiet identity, and direct SOL transfer.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <WalletConnectButton />
            <button
              type="button"
              onClick={() => router.push("/room")}
              className="text-sm text-slate-400 transition hover:text-white"
            >
              Create or join another room
            </button>
          </div>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 rounded-[30px] bg-white/4 p-4">
            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08))] p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
                <span className="inline-flex h-8 items-center rounded-full bg-accent/12 px-3 text-[11px] uppercase tracking-[0.22em] text-accentSoft">
                  {room?.status === "active" ? "Live" : "Waiting"}
                </span>
              </div>
              <div className="mt-4 rounded-2xl bg-black/18 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-100">
                    {room?.status === "active" ? "Peer connected" : "Waiting for peer"}
                  </span>
                  <span className="rounded-full bg-white/6 px-3 py-1 text-xs text-slate-400">
                    {room?.participants.length ?? 0}/2
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08))] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Identity</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-black/18 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">You</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {walletAddress ? shortWallet(walletAddress) : "Anonymous until wallet connect"}
                  </p>
                </div>
                <div className="rounded-2xl bg-black/18 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Peer</p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {peerWallet ? shortWallet(peerWallet) : "Not here yet"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08))] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Share link</p>
              <div className="mt-4 rounded-2xl bg-black/18 p-2">
                <div className="flex items-center justify-between gap-3 rounded-[18px] bg-black/24 px-3 py-3">
                  <span className="font-mono text-xs text-slate-300">/room/{code}</span>
                  <span className="rounded-full bg-white/6 px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-400">
                    Share
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(168,85,247,0.14),rgba(168,85,247,0.06))] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-accentSoft">Transport</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {transportMode === "magicblock"
                  ? "Realtime room routing is enabled through MagicBlock."
                  : "Local preview is active until MagicBlock room routing is configured."}
              </p>
              <div className="mt-4 grid gap-2 text-xs text-slate-200">
                <div className="flex items-center justify-between rounded-2xl bg-black/16 px-3 py-2">
                  <span className="uppercase tracking-[0.2em] text-slate-400">Mode</span>
                  <span>{modeLabel}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/16 px-3 py-2">
                  <span className="uppercase tracking-[0.2em] text-slate-400">Delegation</span>
                  <span>{delegationLabel}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-black/16 px-3 py-2">
                  <span className="uppercase tracking-[0.2em] text-slate-400">Program</span>
                  <span>{programLabel}</span>
                </div>
                {delegation?.fqdn ? (
                  <div className="rounded-2xl bg-black/16 px-3 py-2">
                    <span className="block uppercase tracking-[0.2em] text-slate-400">Node</span>
                    <span className="mt-1 block break-all text-slate-200">{delegation.fqdn}</span>
                  </div>
                ) : null}
                {transportMode === "magicblock" && transport.roomProgramId ? (
                  <div className="rounded-2xl bg-black/16 px-3 py-2">
                    <span className="block uppercase tracking-[0.2em] text-slate-400">Program ID</span>
                    <span className="mt-1 block break-all text-slate-200">{transport.roomProgramId}</span>
                  </div>
                ) : null}
                {transportError ? <p className="pt-1 text-rose-300">{transportError}</p> : null}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[580px] flex-col gap-4">
            <ChatWindow currentWallet={walletAddress} room={room} />
            <div className="flex flex-col gap-3 rounded-[30px] bg-white/4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  Messages are ephemeral and only live while the room is active.
                </p>
                <SendSOLButton
                  busy={paymentState === "Waiting for wallet approval..."}
                  disabled={!wallet.connected || !peerWallet}
                  onSend={handleSendPayment}
                />
              </div>
              <InputBox disabled={!wallet.connected} onSend={(value) => void postMessage(value)} />
              {paymentState ? <p className="text-sm text-slate-400">{paymentState}</p> : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
