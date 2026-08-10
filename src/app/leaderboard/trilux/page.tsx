import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { MIN_ROUNDS_TO_RANK, vegasDayStart, vegasWeekStart } from "@/lib/leaderboard";
import { BoardList, fmtNet, netClass, TOP_N, type RowData } from "@/components/leaderboard-ui";

export const metadata = {
  title: "Trilux Leaderboard — Blackjack Club",
};

type Board = "bankroll" | "today" | "week" | "net";

// Mirrors the club board: same names, same order, High Rollers first and
// default. "All Time" is the one extra — the club has no all-time net board.
const TABS: { id: Board; label: string }[] = [
  { id: "bankroll", label: "High Rollers" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "net", label: "All Time" },
];

/**
 * The Trilux table's own leaderboard, split out from the main board so it can
 * carry more than the single all-time tab it had there.
 *
 * Every net board here filters `Round.room = "trilux"` — chip balances are
 * never consulted, which is why these numbers stayed correct even before the
 * Trilux bankroll became a separate wallet. The Bankroll board is the one
 * exception, and it only became meaningful once `triluxChips` existed.
 */
export default async function TriluxLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leaderboard/trilux");
  const userId = session.user.id;

  const { board: boardParam } = await searchParams;
  const board: Board = (TABS.find((t) => t.id === boardParam)?.id ?? "bankroll") as Board;

  let rows: RowData[] = [];
  let meRow: RowData | null = null;
  let myRank: number | null = null;
  let subtitle = "";
  let callout: string | null = null;

  if (board === "bankroll") {
    subtitle = `The biggest Trilux bankrolls — all time (${MIN_ROUNDS_TO_RANK}+ Trilux rounds to qualify)`;
    // Same qualification gate as the club's High Rollers, and for the same
    // reason: a bankroll can be filled by transferring chips across, so
    // without a rounds requirement someone could top this board without
    // ever playing a hand here.
    const [players, roundCounts] = await Promise.all([
      prisma.user.findMany({
        where: { triluxChips: { gt: 0 } },
        select: { id: true, name: true, triluxChips: true },
        orderBy: [{ triluxChips: "desc" }],
      }),
      prisma.round.groupBy({
        by: ["userId"],
        where: { status: "settled", room: "trilux" },
        _count: true,
      }),
    ]);
    const triluxRounds = new Map(roundCounts.map((r) => [r.userId, r._count]));
    const qualified = players.filter(
      (u) => (triluxRounds.get(u.id) ?? 0) >= MIN_ROUNDS_TO_RANK
    );
    const toRow = (u: (typeof players)[number]): RowData => ({
      id: u.id,
      name: u.name ?? "Player",
      value: u.triluxChips.toLocaleString(),
      detail: `${(triluxRounds.get(u.id) ?? 0).toLocaleString()} rounds`,
    });
    rows = qualified.slice(0, TOP_N).map(toRow);
    const myIdx = qualified.findIndex((u) => u.id === userId);
    if (myIdx >= TOP_N) {
      myRank = myIdx + 1;
      meRow = toRow(qualified[myIdx]);
    } else if (myIdx === -1) {
      const mine = triluxRounds.get(userId) ?? 0;
      callout = `You've played ${mine} of the ${MIN_ROUNDS_TO_RANK} Trilux rounds needed to rank High Rollers here.`;
    }
  } else {
    const start =
      board === "today" ? vegasDayStart() : board === "week" ? vegasWeekStart() : null;
    subtitle =
      board === "today"
        ? "Net at the Trilux table since midnight, Vegas time"
        : board === "week"
          ? "Net at the Trilux table since Monday midnight, Vegas time"
          : "All-time net at the Trilux table — Match the Dealer, Trilux Bonus, Super4 and Lucky Ladies included";

    const rounds = await prisma.round.findMany({
      where: {
        status: "settled",
        room: "trilux",
        ...(start ? { settledAt: { gte: start } } : {}),
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
      const entry = byUser.get(r.userId) ?? { name: r.user.name ?? "Player", net: 0, count: 0 };
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
      callout = `You've played ${mine.count} of the ${MIN_ROUNDS_TO_RANK} Trilux rounds needed to rank (running ${fmtNet(mine.net)}).`;
    } else if (myIdx === -1) {
      callout = `Play ${MIN_ROUNDS_TO_RANK} rounds at the Trilux table to rank here.`;
    }
    if (biggest) {
      callout = `💥 Biggest single Trilux win: ${biggest.name}, ${fmtNet(biggest.net)} on one round.${
        callout ? ` ${callout}` : ""
      }`;
    }
  }

  // Trophy chips for everyone actually shown
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
            Trilux Leaderboard
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
              href={t.id === "bankroll" ? "/leaderboard/trilux" : `/leaderboard/trilux?board=${t.id}`}
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

        {callout && (
          <p
            className="fade-up mt-4 text-center text-xs text-[var(--cream)]/55"
            style={{ animationDelay: "90ms" }}
          >
            {callout}
          </p>
        )}

        <BoardList rows={rows} meRow={meRow} myRank={myRank} userId={userId} />

        <div className="fade-up mt-8 text-center" style={{ animationDelay: "200ms" }}>
          <Link
            href="/leaderboard"
            className="text-sm text-[var(--cream)]/50 underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
          >
            ← Club leaderboards (High Rollers, Today, This Week, Strategy Masters)
          </Link>
        </div>
      </main>
    </div>
  );
}
