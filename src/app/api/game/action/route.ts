import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  applyAction,
  clientView,
  IllegalActionError,
  netResult,
  sideNetFromState,
  type PlayerAction,
} from "@/lib/blackjack/engine";
import {
  getActiveRound,
  parseRoundState,
  roundStatus,
  settleLuckyLadiesPot,
} from "@/lib/game";
import { proBookActive, withHint } from "@/lib/blackjack/strategy";
import {
  earnedFromTrainer,
  earnedThisSettle,
  nextWinStreak,
  type AchievementDef,
} from "@/lib/achievements";
import { awardAchievements } from "@/lib/game-achievements";
import { settleEventFor } from "@/lib/quests";
import { progressQuestsAtSettle } from "@/lib/quests-io";
import { isVoucherActive, voucherBonusFor } from "@/lib/voucher";

const ACTIONS: PlayerAction[] = [
  "hit",
  "stand",
  "double",
  "split",
  "surrender",
  "insurance-yes",
  "insurance-no",
  "even-money-yes",
  "even-money-no",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let action: unknown;
  let blind: unknown;
  let proBook: unknown;
  try {
    ({ action, blind, proBook } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof action !== "string" || !ACTIONS.includes(action as PlayerAction)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const round = await getActiveRound(userId);
  if (!round) {
    return NextResponse.json({ error: "No round in progress" }, { status: 404 });
  }

  const state = parseRoundState(round.stateJson);

  // Strategy Masters: grade the decision against the SERVER's own book,
  // computed from the pre-action state. The client only attests that the
  // guide was hidden (`blind`) — accuracy itself can't be fabricated.
  // Unconditionally basic-strategy — NEVER pass `proBook` here. Strategy
  // Masters' meaning must not shift for a player who opts into the pro book
  // (#9); that grading lives entirely in `proBookPlay` below, written to its
  // own `ProBookStat` table, in addition to (never instead of) this one.
  const bookPlay =
    blind === true ? withHint(state, clientView(state)).hint : null;

  // Pro book (#9): a SEPARATE grade of the same blind decision against the
  // Illustrious 18, recorded to ProBookStat — only when the client actually
  // had pro-book toggled on for this decision and the table is classic (the
  // published indices don't apply to Spanish 21's 10-less shoe).
  const proBookOn = proBookActive(state.variant ?? "classic", proBook === true);
  const proBookPlay =
    blind === true && proBookOn ? withHint(state, clientView(state), true).hint : null;

  let result;
  try {
    result = applyAction(state, action as PlayerAction);
  } catch (err) {
    if (err instanceof IllegalActionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const { state: next, debit } = result;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true, winStreak: true, bestWinStreak: true, voucherExpiresAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (debit > 0 && user.chips < debit) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const settled = next.phase === "settled";

  // Lucky Ladies progressive can land here too: the round was dealt with a
  // QoH pair, the dealer showed an ace, and the post-insurance peek reveals
  // blackjack. (Stakes were already fed to the pot at the deal.)
  let jackpotWon = 0;
  if (settled && next.hands.some((h) => h.llJackpot)) {
    ({ won: jackpotWon } = await settleLuckyLadiesPot(0, true));
  }

  // Win streak: wins extend, losses reset, pushes carry (main game only)
  const roundNet = settled ? netResult(next) : 0;
  const newStreak = settled ? nextWinStreak(user.winStreak, roundNet) : user.winStreak;

  // Match-play voucher: doubles (capped) a main-game win, consumed here —
  // a loss/push doesn't touch it, it just keeps waiting.
  const voucherBonus =
    settled && isVoucherActive(user.voucherExpiresAt) ? voucherBonusFor(roundNet) : 0;

  // A settled round also pays out any riding Dealer Bust bet (side-bet
  // accounting: excluded from payoutTotal, credited here)
  const chipDelta =
    -debit +
    jackpotWon +
    voucherBonus +
    (settled ? next.payoutTotal + (next.bustPayout ?? 0) : 0);

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
    prisma.round.update({
      where: { id: round.id },
      data: {
        status: roundStatus(next),
        stateJson: JSON.stringify(next),
        netResult: settled ? netResult(next) : 0,
        sideNet: settled ? sideNetFromState(next) + jackpotWon : 0,
        settledAt: settled ? new Date() : null,
      },
    }),
  ]);

  // Trophies + trainer bookkeeping happen after the game tx (non-critical)
  const unlocked: AchievementDef[] = [];

  // Record the graded blind decision
  if (bookPlay) {
    const correct = action === bookPlay;
    const existing = await prisma.trainerStat.findUnique({ where: { userId } });
    const streak = correct ? (existing?.streak ?? 0) + 1 : 0;
    const stat = {
      right: (existing?.right ?? 0) + (correct ? 1 : 0),
      wrong: (existing?.wrong ?? 0) + (correct ? 0 : 1),
      best: Math.max(existing?.best ?? 0, streak),
    };
    await prisma.trainerStat.upsert({
      where: { userId },
      create: {
        userId,
        right: correct ? 1 : 0,
        wrong: correct ? 0 : 1,
        streak,
        best: streak,
      },
      update: {
        right: { increment: correct ? 1 : 0 },
        wrong: { increment: correct ? 0 : 1 },
        streak,
        best: stat.best,
      },
    });
    unlocked.push(...(await awardAchievements(userId, earnedFromTrainer(stat))));
  }

  // Pro book (#9): a second, independent grade of the SAME blind decision,
  // written to ProBookStat only — TrainerStat above is never touched by this
  // block, and this block never touches TrainerStat. No achievement hook:
  // the pro book is a personal-only v1 scorecard, not tied into the existing
  // (basic-strategy-only) trainer achievement thresholds.
  if (proBookPlay) {
    const correct = action === proBookPlay;
    const existingPro = await prisma.proBookStat.findUnique({ where: { userId } });
    const proStreak = correct ? (existingPro?.streak ?? 0) + 1 : 0;
    await prisma.proBookStat.upsert({
      where: { userId },
      create: {
        userId,
        right: correct ? 1 : 0,
        wrong: correct ? 0 : 1,
        streak: proStreak,
        best: proStreak,
      },
      update: {
        right: { increment: correct ? 1 : 0 },
        wrong: { increment: correct ? 0 : 1 },
        streak: proStreak,
        best: Math.max(existingPro?.best ?? 0, proStreak),
      },
    });
  }

  if (settled) {
    const roundsPlayed = await prisma.round.count({
      where: { userId, status: "settled" },
    });
    const paidThisSettle =
      next.payoutTotal + (next.bustPayout ?? 0) + jackpotWon;
    const earned = earnedThisSettle({
      state: next,
      jackpotWon,
      chipsAfter: updated.chips,
      chipsBeforePayout: updated.chips - paidThisSettle,
      winStreak: newStreak,
      roundsPlayed,
    });
    unlocked.push(...(await awardAchievements(userId, earned)));
    await progressQuestsAtSettle(userId, settleEventFor(next));
  }

  return NextResponse.json({
    chips: updated.chips,
    // On-screen hint only (never grading, see bookPlay above): respects the
    // client's pro-book toggle for the NEXT decision on this hand.
    round: withHint(next, clientView(next), proBook === true),
    ...(settled ? { winStreak: newStreak } : {}),
    ...(jackpotWon > 0 ? { jackpotWon } : {}),
    ...(unlocked.length > 0 ? { unlocked } : {}),
    ...(voucherBonus > 0 ? { voucherBonus } : {}),
  });
}
