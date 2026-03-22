import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-noise px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/18 blur-3xl" />
        <div className="absolute bottom-20 right-[10%] h-56 w-56 rounded-full bg-fuchsia-400/10 blur-3xl" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center">
        <div className="flex w-full max-w-4xl flex-col items-center gap-10 rounded-[44px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-18 text-center shadow-glow backdrop-blur-xl sm:px-14 sm:py-24">
          <div className="inline-flex items-center rounded-full border border-accent/20 bg-white/4 px-4 py-1.5 text-[11px] uppercase tracking-[0.32em] text-accentSoft">
            Ephemeral 1v1 on Solana
          </div>

          <div className="space-y-4">
            <h1 className="bg-[linear-gradient(180deg,#ffffff_0%,#d8b4fe_100%)] bg-clip-text py-2 text-6xl font-semibold leading-[1.12] tracking-[-0.045em] text-transparent sm:text-[4.75rem] sm:leading-[1.08]">
              MagicSlient
            </h1>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/room"
              className="inline-flex h-14 min-w-[248px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#d8b4fe_0%,#a855f7_48%,#7e22ce_100%)] px-8 text-sm font-semibold tracking-[0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_18px_44px_rgba(168,85,247,0.34)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
            >
              Create or join room
            </Link>
            <a
              href="https://docs.magicblock.gg/pages/get-started/introduction/ephemeral-rollup"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-14 min-w-[248px] items-center justify-center rounded-full border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-8 text-sm font-medium tracking-[0.01em] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/25 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))]"
            >
              MagicBlock docs
            </a>
          </div>

          <div className="grid w-full max-w-2xl gap-3 text-left text-xs uppercase tracking-[0.22em] text-slate-500 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/3 px-4 py-4 text-center">Anonymous</div>
            <div className="rounded-3xl bg-white/3 px-4 py-4 text-center">Realtime</div>
            <div className="rounded-3xl bg-white/3 px-4 py-4 text-center">Ephemeral</div>
          </div>
        </div>
      </div>
    </main>
  );
}
