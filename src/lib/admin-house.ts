import { prisma } from "@/lib/prisma";

// House-side rollup for the pit-boss dashboard, on the same Vegas-clock
// windows as the leaderboards (see leaderboard.ts). "Biggest win" mirrors
// the profile page's convention: ranked by netResult alone, side bets
// excluded, so a lucky Perfect Pairs hit doesn't outrank a real blackjack win.

export interface HouseWindow {
  rounds: number;
  activePlayers: number;
  /** Positive = house is ahead; negative = players are up. */
  housePL: number;
  biggestWin: { userId: string; userName: string; amount: number } | null;
}

export async function houseSummary(since: Date): Promise<HouseWindow> {
  const [agg, distinctPlayers, biggest] = await Promise.all([
    prisma.round.aggregate({
      where: { status: "settled", createdAt: { gte: since } },
      _count: true,
      _sum: { netResult: true, sideNet: true },
    }),
    prisma.round.findMany({
      where: { status: "settled", createdAt: { gte: since } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.round.findFirst({
      where: { status: "settled", createdAt: { gte: since }, netResult: { gt: 0 } },
      orderBy: { netResult: "desc" },
      select: { netResult: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const playerNet = (agg._sum.netResult ?? 0) + (agg._sum.sideNet ?? 0);

  return {
    rounds: agg._count,
    activePlayers: distinctPlayers.length,
    // `-0 || 0` normalizes negative zero — `(-0).toLocaleString()` renders "-0".
    housePL: -playerNet || 0,
    biggestWin: biggest
      ? {
          userId: biggest.user.id,
          userName: biggest.user.name ?? biggest.user.email,
          amount: biggest.netResult,
        }
      : null,
  };
}
