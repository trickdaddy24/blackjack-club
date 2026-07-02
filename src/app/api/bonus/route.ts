import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DAILY_BONUS, getActiveRound, MIN_BET, RESCUE_CHIPS } from "@/lib/game";

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
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: DAILY_BONUS }, lastDailyBonus: now },
      select: { chips: true },
    });
    return NextResponse.json({
      chips: updated.chips,
      granted: DAILY_BONUS,
      type: "daily",
    });
  }

  // Broke rescue: bankrupt with no round in progress gets a comeback stack
  const activeRound = await getActiveRound(userId);
  if (user.chips < MIN_BET && !activeRound) {
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
