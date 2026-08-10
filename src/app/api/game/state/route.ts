import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientView } from "@/lib/blackjack/engine";
import { withHint } from "@/lib/blackjack/strategy";
import { getActiveRound, getLuckyLadiesJackpot, getSuper4Jackpot, parseRoundState } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { getHotSeatState, maybeTriggerHotSeat } from "@/lib/hotseat-io";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Pro-book toggle rides as a query param on this GET (no body) — see
  // GameTable.tsx's `bj-pro-book` localStorage toggle. withHint re-gates on
  // the round's own variant, so this is safe to pass through unconditionally.
  const proBook = new URL(req.url).searchParams.get("pro") === "1";

  // Before the balance is read, not after: if this is the poll that claims and
  // pays a drop, reading chips first would hand back a pre-credit balance
  // alongside a hotSeat payload announcing the award. Never throws — see
  // hotseat-io.ts.
  await maybeTriggerHotSeat();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      chips: true,
      lastDailyBonus: true,
      name: true,
      dealerTips: true,
      winStreak: true,
    },
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
    roundView = withHint(state, clientView(state), proBook);
  }

  return NextResponse.json({
    chips: user.chips,
    name: user.name,
    bonusAvailable,
    round: roundView,
    tableMin: currentTableMinimum(),
    dealerTips: user.dealerTips,
    winStreak: user.winStreak,
    jackpot: await getLuckyLadiesJackpot(),
    super4Jackpot: await getSuper4Jackpot(),
    hotSeat: await getHotSeatState(),
  });
}
