import { prisma } from "@/lib/prisma";

// Shared by /profile, /player/[id], and /admin/users/[id] — the three
// places that render "hands played / win rate / biggest win" for a player.

export interface PlayerRoundStats {
  hands: number;
  wins: number;
  /** 0-100, integer. 0 when hands is 0. */
  winRate: number;
  biggestWin: number | null;
  /** Lifetime sum of netResult across settled rounds. */
  lifetimeNet: number;
}

export async function getPlayerStats(userId: string): Promise<PlayerRoundStats> {
  const [agg, wins, biggest] = await Promise.all([
    prisma.round.aggregate({
      where: { userId, status: "settled" },
      _count: true,
      _sum: { netResult: true },
    }),
    prisma.round.count({
      where: { userId, status: "settled", netResult: { gt: 0 } },
    }),
    prisma.round.findFirst({
      where: { userId, status: "settled", netResult: { gt: 0 } },
      orderBy: { netResult: "desc" },
      select: { netResult: true },
    }),
  ]);

  const hands = agg._count;

  return {
    hands,
    wins,
    winRate: hands > 0 ? Math.round((wins / hands) * 100) : 0,
    biggestWin: biggest?.netResult ?? null,
    lifetimeNet: agg._sum.netResult ?? 0,
  };
}
