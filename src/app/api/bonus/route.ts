import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DAILY_BONUS, getActiveRound, getPromoOverride, RESCUE_CHIPS } from "@/lib/game";
import { currentTableMinimum } from "@/lib/tableMinimum";
import { effectivePromo } from "@/lib/promotions";
import { vegasDayKey } from "@/lib/leaderboard";
import { tierByNumber } from "@/lib/vip";
import { creditData, readBalance, WALLET_SELECT } from "@/lib/wallet";
import { alreadyClaimed, claimField, latestClaim, shouldAdvanceStreak } from "@/lib/claims";
import type { Room } from "@/lib/blackjack/engine";

const ROOMS: Room[] = ["classic", "trilux"];

/** +250 per consecutive claim day past the first, capped at +1,750. */
const STREAK_BOOST_PER_DAY = 250;
const STREAK_BOOST_CAP_DAYS = 7;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Which table the player is claiming from — the daily bonus lands in that
  // table's wallet. Body is optional (older clients / the lobby send none).
  let room: Room = "classic";
  try {
    const body = await req.json();
    if (typeof body?.room === "string" && ROOMS.includes(body.room as Room)) {
      room = body.room as Room;
    }
  } catch {
    /* no body — claim from the main table */
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Each table has its own daily allowance, so claiming at Trilux doesn't
  // consume the main table's (and vice versa).
  const thisTableLast = user[claimField(room, "daily")];
  const dailyAvailable = !alreadyClaimed(thisTableLast, "daily", now);

  if (dailyAvailable) {
    // Login streak on the Vegas calendar: claiming on consecutive PT days
    // grows it; skipping a day resets to 1. It's an ACCOUNT-wide streak, so it
    // advances on the first claim of the day at EITHER table — the second
    // table's claim still pays out but must not double-advance it. The
    // "was it yesterday?" comparison runs against the most recent claim across
    // both tables, so alternating tables day to day still reads as a run.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const anyLast = latestClaim(user.lastDailyBonus, user.triluxLastDailyBonus);
    const advance = shouldAdvanceStreak(user.lastDailyBonus, user.triluxLastDailyBonus, now);
    const lastKey = anyLast ? vegasDayKey(anyLast) : null;
    const yesterdayKey = vegasDayKey(new Date(now.getTime() - DAY_MS));
    const streak = advance
      ? lastKey === yesterdayKey
        ? user.loginStreak + 1
        : 1
      : user.loginStreak;
    const boost = Math.min(streak - 1, STREAK_BOOST_CAP_DAYS) * STREAK_BOOST_PER_DAY;

    // Midnight Madness doubles the whole thing while it runs
    const override = await getPromoOverride();
    const madness = effectivePromo(override, now)?.id === "midnight-madness";
    const vipBoostPct = tierByNumber(user.vipTier).dailyBonusBoostPct;
    const granted = Math.round(
      (DAILY_BONUS + boost) * (1 + vipBoostPct / 100) * (madness ? 2 : 1)
    );
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...creditData(room, granted),
        [claimField(room, "daily")]: now,
        loginStreak: streak,
      },
      select: WALLET_SELECT,
    });
    return NextResponse.json({
      chips: readBalance(updated, room),
      mainChips: updated.chips,
      triluxChips: updated.triluxChips,
      granted,
      type: "daily",
      streak,
      boost,
      vipBoostPct,
      ...(madness ? { promo: "midnight-madness" } : {}),
    });
  }

  // Broke rescue is MAIN-WALLET ONLY, by design. Going broke at Trilux is
  // meant to prompt a transfer from your own main stack, not a house handout —
  // otherwise the Trilux bankroll is a free money tap. See api/wallet/transfer.
  const activeRound = await getActiveRound(userId);
  if (room === "trilux") {
    return NextResponse.json(
      { error: "Out of chips at the Trilux table — move some across from your main stack" },
      { status: 409 }
    );
  }
  if (user.chips < currentTableMinimum().min && !activeRound) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { chips: RESCUE_CHIPS },
      select: WALLET_SELECT,
    });
    return NextResponse.json({
      chips: updated.chips,
      mainChips: updated.chips,
      triluxChips: updated.triluxChips,
      granted: RESCUE_CHIPS - user.chips,
      type: "rescue",
    });
  }

  return NextResponse.json(
    { error: "Daily bonus not available yet" },
    { status: 429 }
  );
}
