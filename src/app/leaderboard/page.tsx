import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Medal } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import {
  MIN_DECISIONS_TO_RANK,
  MIN_ROUNDS_TO_RANK,
  vegasDayStart,
  vegasWeekStart,
} from "@/lib/leaderboard";
import { ensureChampions, latestChampions } from "@/lib/champions";

export const metadata = {
  title: "Leaderboard — Blackjack Club",
};

const TOP_N = 10;

type Board = "stacks" | "today" | "week" | "masters";

const TABS: { id: Board; label: string }[] = [
  { id: "stacks", label: "High Rollers" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "masters", label: "Strategy Masters" },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="font-mono text-sm text-[var(--cream)]/50 tabular-nums">{rank}</span>;
}

interface RowData {
  id: string;
  name: string;
  /** Right-hand number (chips, net, or accuracy). */
  value: string;
  valueClass?: string;
  /** Small middle detail (member-since, rounds played, decision volume). */
  detail?: string;
  /** Achievements unlocked — rendered as a 🏆 chip after the name. */
  trophies?: number;
}

function BoardList({
  rows,
  meRow,
  myRank,
  userId,
}: {
  rows: RowData[];
  meRow: RowData | null;
  myRank: number | null;
  userId: string;
}) {
  const render = (r: RowData, rank: number) => {
    const isMe = r.id === userId;
    return (
      <li
        key={`${r.id}-${rank}`}
        className={`flex items-center gap-4 px-5 py-3 ${
          isMe ? "bg-[var(--gold)]/10 shadow-[inset_2px_0_0_var(--gold)]" : ""
        }`}
      >
        <span className="flex w-8 items-center justify-center">
          <RankBadge rank={rank} />
        </span>
        <span className="flex-1 truncate font-display font-semibold text-[var(--cream)]/90">
          <Link
            href={isMe ? "/profile" : `/player/${r.id}`}
            className="underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
          >
            {r.name}
          </Link>
          {(r.trophies ?? 0) > 0 && (
            <span className="ml-2 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cream)]/60">
              🏆 {r.trophies}
            </span>
          )}
          {isMe && (
            <span className="ml-2 rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gold-bright)]">
              you
            </span>
          )}
        </span>
        {r.detail && (
          <span className="hidden text-xs text-[var(--cream)]/40 sm:block">{r.detail}</span>
        )}
        <span
          className={`font-display text-lg font-bold tabular-nums ${r.valueClass ?? "gold-text"}`}
        >
          {r.value}
        </span>
      </li>
    );
  };

  return (
    <ul
      className="fade-up gold-ring mt-6 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
      style={{ animationDelay: "120ms" }}
    >
      {rows.length === 0 && (
        <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
          Nobody has qualified yet — the board is wide open.
        </li>
      )}
      {rows.map((r, i) => render(r, i + 1))}
      {meRow && myRank !== null && (
        <>
          <li className="px-5 py-1.5 text-center text-xs text-[var(--cream)]/30">···</li>
          {render(meRow, myRank)}
        </>
      )}
    </ul>
  );
}

const fmtNet = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
const netClass = (n: number) =>
  n > 0 ? "gold-text" : n < 0 ? "text-red-300/90" : "text-[var(--cream-dim)]";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { board: boardParam } = await searchParams;
  const board: Board = (TABS.find((t) => t.id === boardParam)?.id ?? "stacks") as Board;

  // Crown the just-closed windows (lazy, idempotent) and fetch the reigning
  // champions for the strip
  await ensureChampions();
  const champions = await latestChampions();

  let rows: RowData[] = [];
  let meRow: RowData | null = null;
  let myRank: number | null = null;
  let subtitle = "";
  let callout: string | null = null;

  if (board === "stacks") {
    subtitle = `The club's biggest chip stacks — all time (${MIN_ROUNDS_TO_RANK}+ rounds to qualify)`;
    const [candidates, roundCounts, me] = await Promise.all([
      prisma.user.findMany({
        orderBy: [{ chips: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, chips: true, createdAt: true },
      }),
      prisma.round.groupBy({
        by: ["userId"],
        where: { status: "settled" },
        _count: true,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, chips: true, createdAt: true },
      }),
    ]);
    if (!me) redirect("/login");
    const roundsByUser = new Map(roundCounts.map((r) => [r.userId, r._count]));
    const qualified = candidates.filter(
      (u) => (roundsByUser.get(u.id) ?? 0) >= MIN_ROUNDS_TO_RANK
    );
    const toRow = (u: (typeof candidates)[number]): RowData => ({
      id: u.id,
      name: u.name ?? "Player",
      value: u.chips.toLocaleString(),
      detail: `since ${u.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    });
    rows = qualified.slice(0, TOP_N).map(toRow);
    const myIdx = qualified.findIndex((u) => u.id === userId);
    if (myIdx >= TOP_N) {
      myRank = myIdx + 1;
      meRow = toRow(qualified[myIdx]);
    } else if (myIdx === -1) {
      const mine = roundsByUser.get(userId) ?? 0;
      callout = `You've played ${mine} of the ${MIN_ROUNDS_TO_RANK} rounds needed to rank High Rollers.`;
    }
  } else if (board === "today" || board === "week") {
    const start = board === "today" ? vegasDayStart() : vegasWeekStart();
    subtitle =
      board === "today"
        ? "Net winnings since midnight, Vegas time — side bets and jackpots included"
        : "Net winnings since Monday midnight, Vegas time";
    const rounds = await prisma.round.findMany({
      where: { status: "settled", settledAt: { gte: start } },
      select: {
        userId: true,
        netResult: true,
        sideNet: true,
        user: { select: { name: true } },
      },
    });
    const byUser = new Map<string, { name: string; net: number; count: number }>();
    let biggest: { name: string; net: number } | null = null;
    for (const r of rounds) {
      const net = r.netResult + r.sideNet;
      const entry = byUser.get(r.userId) ?? {
        name: r.user.name ?? "Player",
        net: 0,
        count: 0,
      };
      entry.net += net;
      entry.count += 1;
      byUser.set(r.userId, entry);
      if (net > 0 && (!biggest || net > biggest.net)) {
        biggest = { name: r.user.name ?? "Player", net };
      }
    }
    const ranked = [...byUser.entries()]
      .filter(([, e]) => e.count >= MIN_ROUNDS_TO_RANK)
      .sort((a, b) => b[1].net - a[1].net);
    const toRow = ([id, e]: (typeof ranked)[number]): RowData => ({
      id,
      name: e.name,
      value: fmtNet(e.net),
      valueClass: netClass(e.net),
      detail: `${e.count} rounds`,
    });
    rows = ranked.slice(0, TOP_N).map(toRow);
    const myIdx = ranked.findIndex(([id]) => id === userId);
    if (myIdx >= TOP_N) {
      myRank = myIdx + 1;
      meRow = toRow(ranked[myIdx]);
    } else if (myIdx === -1 && byUser.has(userId)) {
      const mine = byUser.get(userId)!;
      callout = `You've played ${mine.count} of the ${MIN_ROUNDS_TO_RANK} rounds needed to rank ${
        board === "today" ? "today" : "this week"
      } (running ${fmtNet(mine.net)}).`;
    }
    if (biggest) {
      callout = `💥 Biggest single win: ${biggest.name}, ${fmtNet(biggest.net)} on one round.${
        callout ? ` ${callout}` : ""
      }`;
    }
  } else {
    subtitle = `Best blind-decision accuracy vs the book — ${MIN_DECISIONS_TO_RANK}+ graded decisions to qualify`;
    const stats = await prisma.trainerStat.findMany({
      select: {
        userId: true,
        right: true,
        wrong: true,
        best: true,
        user: { select: { name: true } },
      },
    });
    const qualified = stats
      .map((s) => ({
        id: s.userId,
        name: s.user.name ?? "Player",
        volume: s.right + s.wrong,
        acc: s.right + s.wrong > 0 ? s.right / (s.right + s.wrong) : 0,
        best: s.best,
      }))
      .filter((s) => s.volume >= MIN_DECISIONS_TO_RANK)
      .sort((a, b) => b.acc - a.acc || b.volume - a.volume);
    const toRow = (s: (typeof qualified)[number]): RowData => ({
      id: s.id,
      name: s.name,
      value: `${(s.acc * 100).toFixed(1)}%`,
      detail: `${s.volume.toLocaleString()} decisions · best streak ${s.best}`,
    });
    rows = qualified.slice(0, TOP_N).map(toRow);
    const myIdx = qualified.findIndex((s) => s.id === userId);
    if (myIdx >= TOP_N) {
      myRank = myIdx + 1;
      meRow = toRow(qualified[myIdx]);
    } else if (myIdx === -1) {
      const mine = stats.find((s) => s.userId === userId);
      const vol = mine ? mine.right + mine.wrong : 0;
      callout = `Grade decisions with the trainer on and the guide hidden — ${vol} of ${MIN_DECISIONS_TO_RANK} banked so far.`;
    }
  }

  // Trophy chips: one grouped count for everyone actually shown
  const shownIds = [...rows.map((r) => r.id), ...(meRow ? [meRow.id] : [])];
  if (shownIds.length > 0) {
    const counts = await prisma.achievement.groupBy({
      by: ["userId"],
      where: { userId: { in: shownIds } },
      _count: true,
    });
    const trophyMap = new Map(counts.map((c) => [c.userId, c._count]));
    for (const r of rows) r.trophies = trophyMap.get(r.id) ?? 0;
    if (meRow) meRow.trophies = trophyMap.get(meRow.id) ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">{subtitle}</p>
        </div>

        <nav
          className="fade-up mt-6 flex flex-wrap items-center justify-center gap-1 rounded-full bg-black/30 p-1 gold-ring"
          style={{ animationDelay: "60ms" }}
        >
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "stacks" ? "/leaderboard" : `/leaderboard?board=${t.id}`}
              className={`rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                board === t.id
                  ? "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                  : "text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {(champions.daily || champions.weekly) && (
          <p
            className="fade-up mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs text-[var(--cream)]/60"
            style={{ animationDelay: "75ms" }}
          >
            {champions.daily && (
              <span>
                👑 Yesterday&apos;s champion:{" "}
                <span className="font-semibold text-[var(--gold-bright)]">
                  {champions.daily.name}
                </span>{" "}
                +{champions.daily.amount.toLocaleString()}
              </span>
            )}
            {champions.weekly && (
              <span>
                🏆 Last week:{" "}
                <span className="font-semibold text-[var(--gold-bright)]">
                  {champions.weekly.name}
                </span>{" "}
                +{champions.weekly.amount.toLocaleString()}
              </span>
            )}
          </p>
        )}

        {callout && (
          <p
            className="fade-up mt-4 text-center text-xs text-[var(--cream)]/55"
            style={{ animationDelay: "90ms" }}
          >
            {callout}
          </p>
        )}

        <BoardList rows={rows} meRow={meRow} myRank={myRank} userId={userId} />
      </main>
    </div>
  );
}
