import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, ADMIN_ACTION_LABELS } from "@/lib/admin";
import { getPlayerStats } from "@/lib/player-stats";
import { findRounds } from "@/lib/admin-rounds";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { TopBar } from "@/components/TopBar";
import { Replay } from "@/components/HandReplay";
import { PlayerActions } from "@/components/admin-ui";

export const metadata = {
  title: "Player — Pit Boss Console",
};

// Console pages must never be cached or statically built
export const dynamic = "force-dynamic";

const ROLE_BADGE_CLS =
  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider";

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminId = await requireAdmin();
  if (!adminId) notFound(); // 404, not 403 — the console stays invisible

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      chips: true,
      createdAt: true,
      bestWinStreak: true,
    },
  });
  if (!user) notFound();

  const [stats, trophies, rounds, actions] = await Promise.all([
    getPlayerStats(id),
    prisma.achievement.findMany({ where: { userId: id }, select: { slug: true } }),
    findRounds({ userId: id, window: "all", take: 20 }),
    prisma.adminAction.findMany({ where: { targetId: id }, orderBy: { createdAt: "desc" } }),
  ]);

  const actorIds = [...new Set(actions.map((a) => a.adminId))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorName = new Map(actors.map((a) => [a.id, a.name ?? a.email]));

  const unlocked = new Set(trophies.map((t) => t.slug));

  const statCards = [
    { label: "Chip stack", value: user.chips.toLocaleString() },
    { label: "Hands played", value: stats.hands.toLocaleString() },
    { label: "Win rate", value: stats.hands > 0 ? `${stats.winRate}%` : "—" },
    {
      label: "Biggest win",
      value: stats.biggestWin != null ? `+${stats.biggestWin.toLocaleString()}` : "—",
    },
    { label: "Best streak", value: String(user.bestWinStreak) },
    { label: "Trophies", value: `${unlocked.size} / ${ACHIEVEMENTS.length}` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-red-900/80 py-1 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-red-100">
        Pit Boss Console
      </div>
      <TopBar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8">
          <p className="text-sm text-[var(--cream)]/50">
            <Link href="/admin" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              ← players
            </Link>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
              {user.name ?? "Player"}
            </h1>
            {user.role !== "user" && (
              <span
                className={`${ROLE_BADGE_CLS} ${
                  user.role === "admin"
                    ? "bg-[var(--gold)]/20 text-[var(--gold-bright)]"
                    : "bg-red-900/60 text-red-200"
                }`}
              >
                {user.role}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            {user.email} · joined{" "}
            {user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        <div className="fade-up mt-6 gold-ring rounded-xl bg-black/25 px-4 py-3" style={{ animationDelay: "60ms" }}>
          <PlayerActions userId={user.id} name={user.name ?? "Player"} role={user.role} />
        </div>

        <div className="fade-up mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ animationDelay: "90ms" }}>
          {statCards.map(({ label, value }) => (
            <div key={label} className="gold-ring rounded-xl bg-black/25 px-3 py-4 text-center">
              <div className="font-display text-xl font-bold gold-text tabular-nums">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">{label}</div>
            </div>
          ))}
        </div>

        <section className="fade-up mt-10" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
            Recent Rounds
          </h2>
          <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
            {rounds.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">No rounds yet.</li>
            )}
            {rounds.map((r) => {
              const row = (
                <div className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="text-[var(--cream)]/60">
                    {r.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {r.tableId && <span className="ml-1.5 text-[10px] text-[var(--cream)]/40">👥 duo</span>}
                  </span>
                  <span className="text-[var(--cream)]/50 tabular-nums">bet {r.bet}</span>
                  <span
                    className={`w-20 text-right font-semibold tabular-nums ${
                      r.total > 0
                        ? "text-[var(--gold-bright)]"
                        : r.total < 0
                          ? "text-red-300/80"
                          : "text-[var(--cream)]/50"
                    }`}
                  >
                    {r.total > 0 ? `+${r.total}` : r.total}
                  </span>
                </div>
              );
              return (
                <li key={r.id}>
                  {r.state ? (
                    <details className="group">
                      <summary className="cursor-pointer list-none transition-colors hover:bg-[var(--gold)]/5 group-open:bg-[var(--gold)]/5">
                        {row}
                      </summary>
                      <Replay state={r.state} mine={false} />
                    </details>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-[var(--cream)]/40">
            <Link
              href={`/admin/rounds?userId=${user.id}&window=all`}
              className="text-[var(--gold-bright)] underline-offset-4 hover:underline"
            >
              See full history in round inspector →
            </Link>
          </p>
        </section>

        <section className="fade-up mt-10" style={{ animationDelay: "150ms" }}>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
            Moderation History
          </h2>
          <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
            {actions.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
                Clean record — no actions taken against this account.
              </li>
            )}
            {actions.map((a) => {
              let detail: Record<string, unknown> = {};
              try {
                detail = JSON.parse(a.detail);
              } catch {}
              return (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold text-[var(--cream)]/90">
                      {ADMIN_ACTION_LABELS[a.action] ?? a.action}
                    </span>
                    <span className="text-[var(--cream)]/50">
                      by{" "}
                      <Link
                        href={`/admin/users/${a.adminId}`}
                        className="underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
                      >
                        {actorName.get(a.adminId) ?? a.adminId}
                      </Link>
                    </span>
                    <span className="ml-auto text-xs text-[var(--cream)]/40">
                      {a.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="mt-1 break-words text-xs text-[var(--cream)]/55">
                    {Object.entries(detail).map(([k, v]) => (
                      <span key={k} className="mr-3">
                        <span className="text-[var(--cream)]/35">{k}:</span>{" "}
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
