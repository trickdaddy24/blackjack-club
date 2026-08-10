import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientView } from "@/lib/blackjack/engine";
import { withHint } from "@/lib/blackjack/strategy";
import { getActiveRound, getLuckyLadiesJackpot, getSuper4Jackpot, parseRoundState } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { getHotSeatState, maybeTriggerHotSeat } from "@/lib/hotseat-io";
import { readBalance, WALLET_SELECT } from "@/lib/wallet";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Pro-book toggle rides as a query param on this GET (no body) — see
  // GameTable.tsx's `bj-pro-book` localStorage toggle. withHint re-gates on
  // the round's own variant, so this is safe to pass through unconditionally.
  const url = new URL(req.url);
  const proBook = url.searchParams.get("pro") === "1";
  // Which table the client is sitting at. Needed because BETWEEN HANDS there's
  // no round to read the room from, and falling back to main would show the
  // wrong wallet in the HUD while sitting at Trilux.
  const clientRoom = url.searchParams.get("room") === "trilux" ? "trilux" : "classic";

  // Before the balance is read, not after: if this is the poll that claims and
  // pays a drop, reading chips first would hand back a pre-credit balance
  // alongside a hotSeat payload announcing the award. Never throws — see
  // hotseat-io.ts.
  await maybeTriggerHotSeat();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...WALLET_SELECT,
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

  // A live round is authoritative — you can't be at Trilux with a classic hand
  // open. With no round (between hands) trust the client's declared table, or
  // the HUD shows the main balance while you're sitting at Trilux. Both raw
  // wallets ride along for the transfer panel.
  const stateRoom = roundView?.room ?? clientRoom;
  return NextResponse.json({
    chips: readBalance(user, stateRoom),
    mainChips: user.chips,
    triluxChips: user.triluxChips,
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
