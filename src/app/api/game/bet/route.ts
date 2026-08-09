import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clientView,
  MAX_BOTS,
  MAX_SEATS,
  netResult,
  sideNetFromState,
  startRound,
  type Room,
  type Variant,
} from "@/lib/blackjack/engine";
import {
  getActiveRound,
  getLuckyLadiesJackpot,
  getPreviousCarry,
  getPromoOverride,
  MAX_BET,
  MAX_SIDE_BET,
  roundStatus,
  settleLuckyLadiesPot,
} from "@/lib/game";
import { withHint } from "@/lib/blackjack/strategy";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { effectivePromo } from "@/lib/promotions";
import { earnedThisSettle, nextWinStreak } from "@/lib/achievements";
import { awardAchievements } from "@/lib/game-achievements";
import { settleEventFor } from "@/lib/quests";
import { progressQuestsAtSettle } from "@/lib/quests-io";
import { isVoucherActive, voucherBonusFor } from "@/lib/voucher";

const VARIANTS: Variant[] = ["classic", "spanish21"];
const ROOMS: Room[] = ["classic", "trilux"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let bet: unknown;
  let hands: unknown;
  let variant: unknown;
  let room: unknown;
  let bots: unknown;
  let perfectPairs: unknown;
  let twentyOnePlusThree: unknown;
  let luckyLadies: unknown;
  let matchTheDealer: unknown;
  let triluxBonus: unknown;
  let proBook: unknown;
  try {
    ({
      bet,
      hands,
      variant,
      room,
      bots,
      perfectPairs,
      twentyOnePlusThree,
      luckyLadies,
      matchTheDealer,
      triluxBonus,
      proBook,
    } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tableRoom = room === undefined ? "classic" : room;
  if (typeof tableRoom !== "string" || !ROOMS.includes(tableRoom as Room)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  const tableMin = currentTableMinimum();
  if (typeof bet !== "number" || !Number.isInteger(bet) || bet < tableMin.min || bet > MAX_BET) {
    return NextResponse.json(
      {
        error: `Table minimum is ${tableMin.min} right now (${tableMin.label}) — bet must be a whole number between ${tableMin.min} and ${MAX_BET}`,
      },
      { status: 400 }
    );
  }

  const pp = perfectPairs === undefined ? 0 : perfectPairs;
  if (
    typeof pp !== "number" ||
    !Number.isInteger(pp) ||
    pp < 0 ||
    pp > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `Perfect Pairs bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const tp = twentyOnePlusThree === undefined ? 0 : twentyOnePlusThree;
  if (
    typeof tp !== "number" ||
    !Number.isInteger(tp) ||
    tp < 0 ||
    tp > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `21+3 bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const ll = luckyLadies === undefined ? 0 : luckyLadies;
  if (
    typeof ll !== "number" ||
    !Number.isInteger(ll) ||
    ll < 0 ||
    ll > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `Lucky Ladies bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const mtd = matchTheDealer === undefined ? 0 : matchTheDealer;
  if (
    typeof mtd !== "number" ||
    !Number.isInteger(mtd) ||
    mtd < 0 ||
    mtd > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `Match the Dealer bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const tb = triluxBonus === undefined ? 0 : triluxBonus;
  if (
    typeof tb !== "number" ||
    !Number.isInteger(tb) ||
    tb < 0 ||
    tb > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `Trilux Bonus bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const seats = hands === undefined ? 1 : hands;
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    return NextResponse.json(
      { error: `You can play 1 to ${MAX_SEATS} hands` },
      { status: 400 }
    );
  }

  const tableVariant = variant === undefined ? "classic" : variant;
  if (typeof tableVariant !== "string" || !VARIANTS.includes(tableVariant as Variant)) {
    return NextResponse.json({ error: "Unknown game variant" }, { status: 400 });
  }

  // Each table's side-bet menu is server-authoritative, not just a UI choice:
  // Trilux is classic rules only (Match the Dealer + Trilux Bonus), the
  // classic table keeps Perfect Pairs/21+3. Lucky Ladies rides at both.
  if (tableRoom === "trilux" && tableVariant !== "classic") {
    return NextResponse.json(
      { error: "The Trilux table only deals classic rules" },
      { status: 400 }
    );
  }
  const ppBet = tableRoom === "trilux" ? 0 : pp;
  const tpBet = tableRoom === "trilux" ? 0 : tp;
  const mtdBet = tableRoom === "trilux" ? mtd : 0;
  const tbBet = tableRoom === "trilux" ? tb : 0;

  const botCount = bots === undefined ? 0 : bots;
  if (
    typeof botCount !== "number" ||
    !Number.isInteger(botCount) ||
    botCount < 0 ||
    botCount > MAX_BOTS
  ) {
    return NextResponse.json(
      { error: `You can seat 0 to ${MAX_BOTS} bots` },
      { status: 400 }
    );
  }

  const existing = await getActiveRound(userId);
  if (existing) {
    return NextResponse.json(
      { error: "You already have a round in progress" },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.chips < (bet + ppBet + tpBet + ll + mtdBet + tbBet) * seats) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const carry = await getPreviousCarry(userId);
  const promo = effectivePromo(await getPromoOverride());
  const { state, debit, shuffled, sideBetPayout } = startRound(bet, {
    previousShoe: carry?.shoe ?? null,
    previousVariant: carry?.variant,
    previousCount: carry?.runningCount,
    seats,
    variant: tableVariant as Variant,
    room: tableRoom as Room,
    bots: botCount,
    perfectPairs: ppBet,
    twentyOnePlusThree: tpBet,
    luckyLadies: ll,
    matchTheDealer: mtdBet,
    triluxBonus: tbBet,
    promo: promo?.id ?? null,
  });
  const settled = state.phase === "settled";

  // Lucky Ladies pot: stakes feed it every deal; a QoH pair + dealer
  // blackjack (only possible here if the peek settled the round) wins it all.
  // No LL bet → just read the pot for the table sign.
  const { won: jackpotWon, pot: jackpot } =
    ll > 0
      ? await settleLuckyLadiesPot(
          ll * seats,
          settled && state.hands.some((h) => h.llJackpot)
        )
      : { won: 0, pot: await getLuckyLadiesJackpot() };

  // Win streak: only rounds that settle on the deal (naturals/dealer BJ)
  // move it here — everything else settles in the action route.
  const roundNet = settled ? netResult(state) : 0;
  const newStreak = settled ? nextWinStreak(user.winStreak, roundNet) : user.winStreak;

  // Match-play voucher: doubles (capped) a main-game win, consumed here —
  // a loss/push doesn't touch it, it just keeps waiting.
  const voucherBonus =
    settled && isVoucherActive(user.voucherExpiresAt) ? voucherBonusFor(roundNet) : 0;

  // Side-bet winnings are paid on the spot, in the same transaction as the deal
  const chipDelta =
    -debit + (sideBetPayout ?? 0) + jackpotWon + voucherBonus + (settled ? state.payoutTotal : 0);

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        chips: { increment: chipDelta },
        ...(settled
          ? {
              winStreak: newStreak,
              bestWinStreak: Math.max(user.bestWinStreak, newStreak),
            }
          : {}),
        ...(voucherBonus > 0 ? { voucherExpiresAt: null } : {}),
      },
      select: { chips: true },
    }),
    prisma.round.create({
      data: {
        userId,
        status: roundStatus(state),
        bet,
        stateJson: JSON.stringify(state),
        netResult: settled ? netResult(state) : 0,
        sideNet: settled ? sideNetFromState(state) + jackpotWon : 0,
        settledAt: settled ? new Date() : null,
        room: tableRoom,
      },
    }),
  ]);

  // Deal-settled rounds (naturals, dealer blackjack) run trophy checks here;
  // everything else earns at settle in the action route.
  let unlocked: Awaited<ReturnType<typeof awardAchievements>> = [];
  if (settled) {
    const roundsPlayed = await prisma.round.count({
      where: { userId, status: "settled" },
    });
    const paidThisSettle = (sideBetPayout ?? 0) + jackpotWon + state.payoutTotal;
    unlocked = await awardAchievements(
      userId,
      earnedThisSettle({
        state,
        jackpotWon,
        chipsAfter: updated.chips,
        chipsBeforePayout: updated.chips - paidThisSettle,
        winStreak: newStreak,
        roundsPlayed,
      })
    );
    await progressQuestsAtSettle(userId, settleEventFor(state));
  }

  return NextResponse.json({
    chips: updated.chips,
    round: withHint(state, clientView(state), proBook === true),
    shuffled: shuffled === true,
    jackpot,
    jackpotWon,
    ...(settled ? { winStreak: newStreak } : {}),
    ...(unlocked.length > 0 ? { unlocked } : {}),
    ...(voucherBonus > 0 ? { voucherBonus } : {}),
  });
}
