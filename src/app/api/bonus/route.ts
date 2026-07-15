import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DAILY_BONUS, getActiveRound, RESCUE_CHIPS } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { currentPromo } from "@/lib/promotions";

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
    // Midnight Madness doubles the daily bonus while it runs
    const madness = currentPromo()?.id === "midnight-madness";
    const granted = madness ? DAILY_BONUS * 2 : DAILY_BONUS;
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: granted }, lastDailyBonus: now },
      select: { chips: true },
    });
    return NextResponse.json({
      chips: updated.chips,
      granted,
      type: "daily",
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
