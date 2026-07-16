import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DAILY_BONUS, getActiveRound, RESCUE_CHIPS } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { currentPromo } from "@/lib/promotions";
import { vegasDayKey } from "@/lib/leaderboard";

/** +250 per consecutive claim day past the first, capped at +1,750. */
const STREAK_BOOST_PER_DAY = 250;
const STREAK_BOOST_CAP_DAYS = 7;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const last = user.lastDailyBonus?.getTime() ?? 0;
  const dailyAvailable = now.getTime() - last >= 24 * 60 * 60 * 1000;

  if (dailyAvailable) {
    // Login streak on the Vegas calendar: claiming on consecutive PT days
    // grows it; skipping a day resets to 1.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lastKey = user.lastDailyBonus ? vegasDayKey(user.lastDailyBonus) : null;
    const yesterdayKey = vegasDayKey(new Date(now.getTime() - DAY_MS));
    const streak = lastKey === yesterdayKey ? user.loginStreak + 1 : 1;
    const boost = Math.min(streak - 1, STREAK_BOOST_CAP_DAYS) * STREAK_BOOST_PER_DAY;

    // Midnight Madness doubles the whole thing while it runs
    const madness = currentPromo()?.id === "midnight-madness";
    const granted = (DAILY_BONUS + boost) * (madness ? 2 : 1);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: granted }, lastDailyBonus: now, loginStreak: streak },
      select: { chips: true },
    });
    return NextResponse.json({
      chips: updated.chips,
      granted,
      type: "daily",
      streak,
      boost,
      ...(madness ? { promo: "midnight-madness" } : {}),
    });
  }

  // Broke rescue: can't cover the current table minimum with no round going
  const activeRound = await getActiveRound(userId);
  if (user.chips < currentTableMinimum().min && !activeRound) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chips: RESCUE_CHIPS },
      select: { chips: true },
    });
    return NextResponse.json({
      chips: updated.chips,
      granted: RESCUE_CHIPS - user.chips,
      type: "rescue",
    });
  }

  return NextResponse.json(
    { error: "Daily bonus not available yet" },
    { status: 429 }
  );
}
