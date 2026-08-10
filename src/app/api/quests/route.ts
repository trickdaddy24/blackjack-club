import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { totalWorth, WALLET_SELECT } from "@/lib/wallet";
import { vegasDayKey } from "@/lib/leaderboard";
import { CLEAN_SWEEP, CLEAN_SWEEP_SLUG, dailyQuests } from "@/lib/quests";
import { getSweepStreak } from "@/lib/quests-io";

/** GET: today's three quests with my progress, plus my login streak. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const day = vegasDayKey();
  const defs = dailyQuests(day);

  const [rows, user, sweepStreak] = await Promise.all([
    prisma.questProgress.findMany({
      // Include the reserved Clean Sweep slug so the client can tell
      // "all three done" apart from "all three done AND the bonus paid".
      where: { userId, day, slug: { in: [...defs.map((d) => d.slug), CLEAN_SWEEP_SLUG] } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { loginStreak: true, ...WALLET_SELECT },
    }),
    getSweepStreak(userId),
  ]);
  const byslug = new Map(rows.map((r) => [r.slug, r]));

  return NextResponse.json({
    day,
    loginStreak: user?.loginStreak ?? 0,
    chips: user ? totalWorth(user) : 0,
    cleanSweep: {
      name: CLEAN_SWEEP.name,
      emoji: CLEAN_SWEEP.emoji,
      description: CLEAN_SWEEP.description,
      reward: CLEAN_SWEEP.reward,
      claimed: byslug.get(CLEAN_SWEEP_SLUG)?.done ?? false,
      streak: sweepStreak,
    },
    quests: defs.map((d) => ({
      slug: d.slug,
      name: d.name,
      emoji: d.emoji,
      description: d.description,
      target: d.target,
      reward: d.reward,
      progress: Math.min(byslug.get(d.slug)?.progress ?? 0, d.target),
      done: byslug.get(d.slug)?.done ?? false,
    })),
  });
}
