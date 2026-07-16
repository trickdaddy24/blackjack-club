// Board champions — lazy window awards. No cron: whoever loads the
// leaderboard first after a Vegas midnight (or Monday midnight) triggers the
// evaluation of the just-closed window. A BoardAward row per (board, window)
// marks it paid — amount 0 means "evaluated, nobody qualified".

import { prisma } from "@/lib/prisma";
import {
  MIN_ROUNDS_TO_RANK,
  previousVegasDayStart,
  previousVegasWeekStart,
  vegasDayStart,
  vegasWeekStart,
} from "@/lib/leaderboard";
import { awardAchievements } from "@/lib/game-achievements";

export const DAILY_CHAMPION_PRIZE = 2_500;
export const WEEKLY_CHAMPION_PRIZE = 10_000;

interface WindowSpec {
  board: "daily" | "weekly";
  start: Date;
  end: Date;
  prize: number;
}

/** Top qualified net (rounds >= MIN_ROUNDS_TO_RANK) in [start, end). */
async function windowWinner(start: Date, end: Date) {
  const rounds = await prisma.round.findMany({
    where: { status: "settled", settledAt: { gte: start, lt: end } },
    select: { userId: true, netResult: true, sideNet: true },
  });
  const byUser = new Map<string, { net: number; count: number }>();
  for (const r of rounds) {
    const e = byUser.get(r.userId) ?? { net: 0, count: 0 };
    e.net += r.netResult + r.sideNet;
    e.count += 1;
    byUser.set(r.userId, e);
  }
  const qualified = [...byUser.entries()]
    .filter(([, e]) => e.count >= MIN_ROUNDS_TO_RANK)
    .sort((a, b) => b[1].net - a[1].net);
  return qualified[0] ?? null;
}

async function ensureWindow(spec: WindowSpec) {
  const existing = await prisma.boardAward.findUnique({
    where: { board_windowStart: { board: spec.board, windowStart: spec.start } },
  });
  if (existing) return;

  const winner = await windowWinner(spec.start, spec.end);
  try {
    await prisma.boardAward.create({
      data: {
        board: spec.board,
        windowStart: spec.start,
        userId: winner?.[0] ?? null,
        amount: winner ? spec.prize : 0,
      },
    });
  } catch {
    return; // a racing request evaluated it first — they pay, we stop
  }
  if (winner) {
    await prisma.user.update({
      where: { id: winner[0] },
      data: { chips: { increment: spec.prize } },
    });
    await awardAchievements(winner[0], ["board-champion"]);
  }
}

/** Evaluate the just-closed daily and weekly windows (idempotent, cheap). */
export async function ensureChampions(now: Date = new Date()): Promise<void> {
  try {
    await ensureWindow({
      board: "daily",
      start: previousVegasDayStart(now),
      end: vegasDayStart(now),
      prize: DAILY_CHAMPION_PRIZE,
    });
    await ensureWindow({
      board: "weekly",
      start: previousVegasWeekStart(now),
      end: vegasWeekStart(now),
      prize: WEEKLY_CHAMPION_PRIZE,
    });
  } catch (err) {
    console.error("champion evaluation failed:", (err as Error).message);
  }
}

/** Latest paid champions, for the leaderboard callout. */
export async function latestChampions() {
  const awards = await prisma.boardAward.findMany({
    where: { userId: { not: null } },
    orderBy: { windowStart: "desc" },
    take: 6,
  });
  const daily = awards.find((a) => a.board === "daily");
  const weekly = awards.find((a) => a.board === "weekly");
  const ids = [daily?.userId, weekly?.userId].filter((x): x is string => Boolean(x));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? "Player"]));
  return {
    daily: daily ? { name: nameOf.get(daily.userId!) ?? "Player", amount: daily.amount } : null,
    weekly: weekly ? { name: nameOf.get(weekly.userId!) ?? "Player", amount: weekly.amount } : null,
  };
}
