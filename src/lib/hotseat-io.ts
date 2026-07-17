// Hot Seat IO: the lazy trigger + the broadcast read. No cron — whichever
// player's /api/game/state poll lands after nextDropAt claims the draw via
// a CAS on the singleton row (same updateMany-where-known-value pattern as
// the shared table's turn enforcement). Non-critical path: a failure here
// never breaks the poll it rode in on.

import { prisma } from "@/lib/prisma";
import {
  HOT_SEAT_ACTIVE_WINDOW_MS,
  pickWinnerIndex,
  rollAmount,
  rollIntervalMs,
} from "@/lib/hotseat";

const ROW_ID = "global";

export interface HotSeatState {
  winnerId: string | null;
  winnerName: string | null;
  amount: number | null;
  awardedAt: Date | null;
}

function toState(row: {
  lastWinnerId: string | null;
  lastWinnerName: string | null;
  lastAmount: number | null;
  lastAwardedAt: Date | null;
} | null): HotSeatState {
  return {
    winnerId: row?.lastWinnerId ?? null,
    winnerName: row?.lastWinnerName ?? null,
    amount: row?.lastAmount ?? null,
    awardedAt: row?.lastAwardedAt ?? null,
  };
}

/** Currently-active players eligible for a drop: mid-hand, or settled recently. */
async function activePlayerPool(now: Date): Promise<{ id: string; name: string | null }[]> {
  const cutoff = new Date(now.getTime() - HOT_SEAT_ACTIVE_WINDOW_MS);
  const rounds = await prisma.round.findMany({
    where: {
      OR: [{ status: { not: "settled" } }, { settledAt: { gte: cutoff } }],
    },
    select: { userId: true },
    distinct: ["userId"],
  });
  if (rounds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rounds.map((r) => r.userId) }, role: { not: "banned" } },
    select: { id: true, name: true },
  });
  return users;
}

/**
 * If the global clock has elapsed, draw a winner from the active pool and
 * credit them. Safe to call on every state poll — no-ops almost always.
 */
export async function maybeTriggerHotSeat(now: Date = new Date()): Promise<void> {
  try {
    const row = await prisma.hotSeatDrop.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, nextDropAt: new Date(now.getTime() + rollIntervalMs()) },
      update: {},
    });
    if (now < row.nextDropAt) return;

    // Claim the turn by advancing the clock first — losers of the race stop here.
    const claimed = await prisma.hotSeatDrop.updateMany({
      where: { id: ROW_ID, nextDropAt: row.nextDropAt },
      data: { nextDropAt: new Date(now.getTime() + rollIntervalMs()) },
    });
    if (claimed.count === 0) return;

    const pool = await activePlayerPool(now);
    if (pool.length === 0) return; // clock ticked, nobody was around to catch it

    const winner = pool[pickWinnerIndex(pool.length)];
    const amount = rollAmount();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: winner.id },
        data: { chips: { increment: amount } },
      }),
      prisma.hotSeatDrop.update({
        where: { id: ROW_ID },
        data: {
          lastWinnerId: winner.id,
          lastWinnerName: winner.name ?? "Player",
          lastAmount: amount,
          lastAwardedAt: now,
        },
      }),
    ]);
  } catch (err) {
    console.error("hot seat drop failed:", (err as Error).message);
  }
}

/** The most recent drop, for broadcasting to every client on /api/game/state. */
export async function getHotSeatState(): Promise<HotSeatState> {
  const row = await prisma.hotSeatDrop.findUnique({ where: { id: ROW_ID } });
  return toState(row);
}
