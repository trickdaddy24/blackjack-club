import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientView } from "@/lib/blackjack/engine";
import { getActiveRound, parseRoundState } from "@/lib/game";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true, lastDailyBonus: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const round = await getActiveRound(userId);

  const now = Date.now();
  const last = user.lastDailyBonus?.getTime() ?? 0;
  const bonusAvailable = now - last >= 24 * 60 * 60 * 1000;

  return NextResponse.json({
    chips: user.chips,
    name: user.name,
    bonusAvailable,
    round: round ? clientView(parseRoundState(round.stateJson)) : null,
  });
}
