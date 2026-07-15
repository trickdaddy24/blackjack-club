import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientView } from "@/lib/blackjack/engine";
import { withHint } from "@/lib/blackjack/strategy";
import { getActiveRound, getLuckyLadiesJackpot, parseRoundState } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true, lastDailyBonus: true, name: true, dealerTips: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const round = await getActiveRound(userId);

  const now = Date.now();
  const last = user.lastDailyBonus?.getTime() ?? 0;
  const bonusAvailable = now - last >= 24 * 60 * 60 * 1000;

  let roundView = null;
  if (round) {
    const state = parseRoundState(round.stateJson);
    roundView = withHint(state, clientView(state));
  }

  return NextResponse.json({
    chips: user.chips,
    name: user.name,
    bonusAvailable,
    round: roundView,
    tableMin: currentTableMinimum(),
    dealerTips: user.dealerTips,
    jackpot: await getLuckyLadiesJackpot(),
  });
}
