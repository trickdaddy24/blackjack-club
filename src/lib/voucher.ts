// Match-play vouchers — the pure half. A "welcome back" mechanic: return
// after being away long enough and the next real win (main game only) gets
// doubled, up to a cap. IO (granting, consuming) lives in voucher-io.ts and
// directly in the settle routes, so vitest loads this without Prisma.

import { vegasDayKey } from "./leaderboard";

/** How long away (since the last settled round) before a fresh voucher is offered. */
export const VOUCHER_AWAY_MS = 6 * 60 * 60 * 1000;
/** How long an active voucher stays claimable once granted. */
export const VOUCHER_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Ceiling on the bonus amount a voucher adds — the round's own payout is uncapped. */
export const VOUCHER_BONUS_CAP = 10_000;

/** The bonus a voucher adds on top of a win — doubles it, capped. Zero for a loss/push. */
export function voucherBonusFor(netWin: number): number {
  if (netWin <= 0) return 0;
  return Math.min(netWin, VOUCHER_BONUS_CAP);
}

export function isVoucherActive(voucherExpiresAt: Date | null, now: Date = new Date()): boolean {
  return voucherExpiresAt !== null && voucherExpiresAt.getTime() > now.getTime();
}

/** Eligible for a fresh voucher: has played before, and it's been long enough. */
export function isAwayLongEnough(lastSettledAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSettledAt) return false;
  return now.getTime() - lastSettledAt.getTime() >= VOUCHER_AWAY_MS;
}

/** One grant per Vegas day, regardless of whether it was used, expired, or is still active. */
export function alreadyGrantedToday(
  lastVoucherGrantedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastVoucherGrantedAt) return false;
  return vegasDayKey(lastVoucherGrantedAt) === vegasDayKey(now);
}
