import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getLuckyLadiesJackpot } from "@/lib/game";
import { houseSummary } from "@/lib/admin-house";
import { vegasDayStart, vegasWeekStart } from "@/lib/leaderboard";
import { PROMO_SCHEDULE, promoStatus } from "@/lib/promotions";
import { TopBar } from "@/components/TopBar";
import { JackpotPanel, PromoForcePanel } from "@/components/admin-house-ui";

export const metadata = {
  title: "House Dashboard — Blackjack Club",
};

// Console pages must never be cached or statically built
export const dynamic = "force-dynamic";

function WindowCard({
  title,
  rounds,
  activePlayers,
  housePL,
  biggestWin,
}: {
  title: string;
  rounds: number;
  activePlayers: number;
  housePL: number;
  biggestWin: { userId: string; userName: string; amount: number } | null;
}) {
  return (
    <div className="gold-ring rounded-xl bg-black/25 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--cream)]/50">{title}</div>
      <div
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          housePL >= 0 ? "text-[var(--gold-bright)]" : "text-red-300/80"
        }`}
      >
        {housePL >= 0 ? "+" : ""}
        {housePL.toLocaleString()}
        <span className="ml-1.5 text-xs font-normal uppercase tracking-wider text-[var(--cream)]/40">
          house P&L
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--cream)]/55">
        <span>{rounds.toLocaleString()} rounds</span>
        <span>{activePlayers.toLocaleString()} active players</span>
        {biggestWin && (
          <span>
            biggest win{" "}
            <Link
              href={`/player/${biggestWin.userId}`}
              className="text-[var(--gold-bright)] underline-offset-4 hover:underline"
            >
              {biggestWin.userName}
            </Link>{" "}
            +{biggestWin.amount.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default async function HousePage() {
  const adminId = await requireAdmin();
  if (!adminId) notFound(); // 404, not 403 — the console stays invisible

  const [pot, today, week, override] = await Promise.all([
    getLuckyLadiesJackpot(),
    houseSummary(vegasDayStart()),
    houseSummary(vegasWeekStart()),
    prisma.promoOverride.findUnique({ where: { id: "global" }, select: { promoId: true, expiresAt: true } }),
  ]);

  const now = new Date();
  const activeOverride =
    override?.promoId && override.expiresAt && override.expiresAt > now
      ? { promoId: override.promoId, expiresAt: override.expiresAt.toISOString() }
      : null;
  const status = promoStatus(now);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-red-900/80 py-1 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-red-100">
        Pit Boss Console
      </div>
      <TopBar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">House Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            <Link href="/admin" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              players
            </Link>
            {" · "}
            <Link href="/admin/rounds" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              round inspector
            </Link>
            {" · "}
            <Link href="/admin/audit" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              audit log
            </Link>
          </p>
        </div>

        <div className="fade-up mt-6 grid gap-3 sm:grid-cols-2" style={{ animationDelay: "60ms" }}>
          <WindowCard title="Today" {...today} />
          <WindowCard title="This week" {...week} />
        </div>

        <div className="fade-up mt-6 grid gap-3 sm:grid-cols-2" style={{ animationDelay: "90ms" }}>
          <JackpotPanel pot={pot} />
          <PromoForcePanel schedule={PROMO_SCHEDULE} activeOverride={activeOverride} />
        </div>

        <section className="fade-up mt-6" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
            Promo Calendar
          </h2>
          <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
            {PROMO_SCHEDULE.map((p) => {
              const live = status.active?.id === p.id;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div>
                    <span className="font-display font-semibold text-[var(--cream)]/90">{p.name}</span>
                    <span className="ml-2 text-xs text-[var(--cream)]/45">{p.hours} PT</span>
                  </div>
                  {live && (
                    <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-200">
                      live
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
