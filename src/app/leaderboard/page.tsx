import Link from "next/link";
import { redirect } from "next/navigation";
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
import { totalWorth, WALLET_SELECT } from "@/lib/wallet";
import { BoardList, fmtNet, netClass, TOP_N, type RowData } from "@/components/leaderboard-ui";

export const metadata = {
  title: "Leaderboard — Blackjack Club",
};


type Board = "stacks" | "today" | "week" | "masters";

const TABS: { id: Board; label: string }[] = [
  { id: "stacks", label: "High Rollers" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "masters", label: "Strategy Masters" },
];


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
      // Ranked on NET WORTH across both wallets, so funding a Trilux bankroll
      // never costs rank. Prisma can't orderBy a sum of two columns, so the
      // sort happens in JS below — this query already fetched every user and
      // filtered in JS anyway.
      prisma.user.findMany({
        select: { id: true, name: true, ...WALLET_SELECT, createdAt: true },
      }),
      prisma.round.groupBy({
        by: ["userId"],
        where: { status: "settled" },
        _count: true,
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, ...WALLET_SELECT, createdAt: true },
      }),
    ]);
    if (!me) redirect("/login");
    const roundsByUser = new Map(roundCounts.map((r) => [r.userId, r._count]));
    const qualified = candidates
      .filter((u) => (roundsByUser.get(u.id) ?? 0) >= MIN_ROUNDS_TO_RANK)
      // Same ordering the DB used to do: worth desc, oldest account breaks ties.
      .sort(
        (a, b) =>
          totalWorth(b) - totalWorth(a) || a.createdAt.getTime() - b.createdAt.getTime()
      );
    const toRow = (u: (typeof candidates)[number]): RowData => ({
      id: u.id,
      name: u.name ?? "Player",
      value: totalWorth(u).toLocaleString(),
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
    // Club-wide: both tables count. Trilux-only boards live at
    // /leaderboard/trilux.
    const rounds = await prisma.round.findMany({
      where: {
        status: "settled",
        settledAt: { gte: start },
      },
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
      const windowLabel = board === "today" ? "today" : "this week";
      callout = `You've played ${mine.count} of the ${MIN_ROUNDS_TO_RANK} rounds needed to rank ${windowLabel} (running ${fmtNet(mine.net)}).`;
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

        <p
          className="fade-up mt-3 text-center text-xs text-[var(--cream)]/45"
          style={{ animationDelay: "70ms" }}
        >
          <Link
            href="/leaderboard/trilux"
            className="text-[var(--gold-bright)]/80 underline-offset-4 hover:underline"
          >
            🔷 Trilux table has its own leaderboards →
          </Link>
        </p>

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
