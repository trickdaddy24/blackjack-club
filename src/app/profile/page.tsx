import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, TrendingUp, Layers, Trophy, Flame, Swords } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { rivalRecords } from "@/lib/rivals";
import type { RoundState } from "@/lib/blackjack/engine";
import { handValue } from "@/lib/blackjack/engine";

export const metadata = {
  title: "Your Record — Blackjack Club",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, agg, wins, biggest, trophies] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        chips: true,
        createdAt: true,
        winStreak: true,
        bestWinStreak: true,
      },
    }),
    prisma.round.aggregate({
      where: { userId: session.user.id, status: "settled" },
      _count: true,
      _sum: { netResult: true },
    }),
    prisma.round.count({
      where: { userId: session.user.id, status: "settled", netResult: { gt: 0 } },
    }),
    prisma.round.findFirst({
      where: { userId: session.user.id, status: "settled", netResult: { gt: 0 } },
      orderBy: { netResult: "desc" },
      select: { netResult: true },
    }),
    prisma.achievement.findMany({
      where: { userId: session.user.id },
      select: { slug: true, unlockedAt: true },
    }),
  ]);

  if (!user) redirect("/login");

  const hands = agg._count;
  const net = agg._sum.netResult ?? 0;
  const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;

  const stats = [
    { icon: Coins, label: "Chip stack", value: user.chips.toLocaleString() },
    { icon: Layers, label: "Hands played", value: hands.toLocaleString() },
    { icon: TrendingUp, label: "Win rate", value: hands > 0 ? `${winRate}%` : "—" },
    { icon: Trophy, label: "Biggest win", value: biggest ? `+${biggest.netResult.toLocaleString()}` : "—" },
    {
      icon: Flame,
      label: "Win streak",
      value: hands > 0 ? `${user.winStreak} · best ${user.bestWinStreak}` : "—",
    },
    {
      icon: Trophy,
      label: "Trophies",
      value: `${trophies.length} / ${ACHIEVEMENTS.length}`,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            {user.name ?? "Player"}
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            At the table since{" "}
            {user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {" · "}
            lifetime {net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString()} chips
          </p>
        </div>

        <div className="fade-up mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="gold-ring rounded-xl bg-black/25 px-3 py-5 text-center">
              <Icon className="mx-auto mb-2 h-4 w-4 text-[var(--gold)]/70" />
              <div className="font-display text-xl font-bold gold-text tabular-nums">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
                {label}
              </div>
            </div>
          ))}
        </div>

        <Sparkline userId={session.user.id} />

        <Rivalries userId={session.user.id} />

        <TrophyCase unlocked={trophies} />

        <RecentHands userId={session.user.id} />
      </main>
    </div>
  );
}

/** Cumulative net over the last 100 rounds — the shape of your luck. */
async function Sparkline({ userId }: { userId: string }) {
  const rounds = await prisma.round.findMany({
    where: { userId, status: "settled" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { netResult: true, sideNet: true },
  });
  if (rounds.length < 5) return null;
  rounds.reverse();
  let sum = 0;
  const points = rounds.map((r) => (sum += r.netResult + r.sideNet));
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = Math.max(1, max - min);
  const W = 560;
  const H = 64;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / span) * H;
  const poly = points.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <section className="fade-up mt-10" style={{ animationDelay: "150ms" }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        Last {points.length} rounds{" "}
        <span className={last >= 0 ? "text-[var(--gold-bright)]" : "text-red-300/80"}>
          {last >= 0 ? "+" : ""}
          {last.toLocaleString()}
        </span>
      </h2>
      <div className="gold-ring overflow-hidden rounded-2xl bg-black/25 px-4 py-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none" aria-label="Net result trend">
          <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#ffffff22" strokeWidth="1" strokeDasharray="4 4" />
          <polyline
            points={poly}
            fill="none"
            stroke={last >= 0 ? "var(--gold)" : "#f87171"}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}

/** Duo-table head-to-head records. */
async function Rivalries({ userId }: { userId: string }) {
  const rivals = (await rivalRecords(userId)).slice(0, 5);
  if (rivals.length === 0) return null;
  return (
    <section className="fade-up mt-10" style={{ animationDelay: "165ms" }}>
      <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        <Swords className="h-4 w-4" /> Rivalries
      </h2>
      <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
        {rivals.map((r) => (
          <li key={r.userId} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <Link
              href={`/player/${r.userId}`}
              className="font-display font-semibold text-[var(--cream)]/90 underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
            >
              {r.name}
            </Link>
            <span className="text-xs text-[var(--cream)]/45">{r.rounds} shared rounds</span>
            <span
              className={`font-display font-bold tabular-nums ${
                r.wins > r.losses ? "gold-text" : r.wins < r.losses ? "text-red-300/85" : "text-[var(--cream)]/60"
              }`}
            >
              {r.wins} – {r.losses}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrophyCase({
  unlocked,
}: {
  unlocked: { slug: string; unlockedAt: Date }[];
}) {
  const bySlug = new Map(unlocked.map((t) => [t.slug, t.unlockedAt]));
  return (
    <section className="fade-up mt-10" style={{ animationDelay: "180ms" }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        Trophy Case
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const at = bySlug.get(a.slug);
          return (
            <div
              key={a.slug}
              className={`gold-ring rounded-xl px-3 py-4 text-center ${
                at ? "bg-[var(--gold)]/10" : "bg-black/25 opacity-45 grayscale"
              }`}
              title={a.description}
            >
              <div className="text-2xl leading-none">{a.emoji}</div>
              <div className="mt-2 font-display text-sm font-bold gold-text">{a.name}</div>
              <div className="mt-1 text-[11px] leading-snug text-[var(--cream)]/55">
                {a.description}
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-wider text-[var(--cream)]/40">
                {at
                  ? at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const red = suit === "H" || suit === "D";
  return (
    <span
      className={`inline-flex items-center rounded border border-black/20 bg-[#f5efdc] px-1 font-mono text-[11px] font-bold ${
        red ? "text-red-700" : "text-slate-900"
      }`}
    >
      {rank}
      {SUIT_GLYPH[suit]}
    </span>
  );
}

/** Server-side sanitized replay — parses stateJson, NEVER ships the shoe. */
function Replay({ state, mine }: { state: RoundState; mine: boolean }) {
  const dealerTotal = handValue(state.dealer).total;
  return (
    <div className="space-y-2 border-t border-[var(--gold)]/10 bg-black/25 px-5 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-[var(--cream)]/45">Dealer</span>
        {state.dealer.map((c, i) => (
          <MiniCard key={i} rank={c.rank} suit={c.suit} />
        ))}
        <span className="text-[var(--cream)]/55 tabular-nums">
          {dealerTotal}
          {dealerTotal > 21 ? " — BUST" : ""}
        </span>
      </div>
      {state.hands.map((h, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-[var(--cream)]/45">
            {state.hands.length > 1 ? `Hand ${i + 1}` : mine ? "You" : "Hand"}
          </span>
          {h.cards.map((c, ci) => (
            <MiniCard key={ci} rank={c.rank} suit={c.suit} />
          ))}
          <span className="text-[var(--cream)]/55 tabular-nums">{handValue(h.cards).total}</span>
          {h.doubled && <span className="text-[var(--cream)]/45">×2</span>}
          {h.outcome && (
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
                h.outcome === "lose"
                  ? "bg-red-900/60 text-red-200"
                  : h.outcome === "push"
                    ? "bg-black/40 text-[var(--cream)]/60"
                    : "bg-[var(--gold)]/70 text-black"
              }`}
            >
              {h.outcome}
            </span>
          )}
          {[
            ["PP", h.pp],
            ["21+3", h.tp],
            ["LL", h.ll],
          ].map(([label, sb]) =>
            sb && typeof sb === "object" ? (
              <span
                key={label as string}
                className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                  sb.payout > 0 ? "bg-emerald-500/25 text-emerald-200" : "bg-black/40 text-[var(--cream)]/40"
                }`}
              >
                {label as string} {sb.payout > 0 ? `+${sb.payout - sb.bet}` : `−${sb.bet}`}
              </span>
            ) : null
          )}
        </div>
      ))}
      {(state.bustBet ?? 0) > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-16 text-[var(--cream)]/45">Bust bet</span>
          <span
            className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
              (state.bustPayout ?? 0) > 0
                ? "bg-emerald-500/25 text-emerald-200"
                : "bg-black/40 text-[var(--cream)]/40"
            }`}
          >
            {(state.bustPayout ?? 0) > 0
              ? `dealer busted +${(state.bustPayout ?? 0) - state.bustBet}`
              : `dealer stood −${state.bustBet}`}
          </span>
        </div>
      )}
    </div>
  );
}

async function RecentHands({ userId }: { userId: string }) {
  const rounds = await prisma.round.findMany({
    where: { userId, status: "settled" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      bet: true,
      netResult: true,
      sideNet: true,
      createdAt: true,
      stateJson: true,
      tableId: true,
    },
  });

  if (rounds.length === 0) return null;

  return (
    <section className="fade-up mt-10" style={{ animationDelay: "240ms" }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        Recent Hands <span className="text-[var(--cream)]/35">— tap a row to replay it</span>
      </h2>
      <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
        {rounds.map((r) => {
          let state: RoundState | null = null;
          try {
            state = JSON.parse(r.stateJson) as RoundState;
          } catch {
            /* pre-parse rounds render without a replay */
          }
          const total = r.netResult + r.sideNet;
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
                  total > 0
                    ? "text-[var(--gold-bright)]"
                    : total < 0
                      ? "text-red-300/80"
                      : "text-[var(--cream)]/50"
                }`}
              >
                {total > 0 ? `+${total}` : total}
              </span>
            </div>
          );
          return (
            <li key={r.id}>
              {state ? (
                <details className="group">
                  <summary className="cursor-pointer list-none transition-colors hover:bg-[var(--gold)]/5 group-open:bg-[var(--gold)]/5">
                    {row}
                  </summary>
                  <Replay state={state} mine={!r.tableId} />
                </details>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
