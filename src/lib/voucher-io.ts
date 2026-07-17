// Match-play voucher IO: lazy, no cron. Whichever poll lands after a
// player's been away long enough grants the voucher via a CAS updateMany
// (same pattern as hotseat-io.ts / vip-io.ts). Consuming the voucher (the
// double-win bonus) happens inline in the bet/action settle routes, in the
// same transaction as the payout — see VOUCHER_BONUS_CAP in voucher.ts.

import { prisma } from "@/lib/prisma";
import {
  VOUCHER_WINDOW_MS,
  alreadyGrantedToday,
  isAwayLongEnough,
  isVoucherActive,
} from "@/lib/voucher";

export interface VoucherState {
  active: boolean;
  expiresAt: Date | null;
  justGranted: boolean;
}

export async function getVoucherState(userId: string, now: Date = new Date()): Promise<VoucherState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { voucherExpiresAt: true, lastVoucherGrantedAt: true },
  });

  if (isVoucherActive(user.voucherExpiresAt, now)) {
    return { active: true, expiresAt: user.voucherExpiresAt, justGranted: false };
  }

  if (alreadyGrantedToday(user.lastVoucherGrantedAt, now)) {
    return { active: false, expiresAt: null, justGranted: false };
  }

  const lastRound = await prisma.round.findFirst({
    where: { userId, status: "settled" },
    orderBy: { settledAt: "desc" },
    select: { settledAt: true },
  });
  if (!isAwayLongEnough(lastRound?.settledAt ?? null, now)) {
    return { active: false, expiresAt: null, justGranted: false };
  }

  const expiresAt = new Date(now.getTime() + VOUCHER_WINDOW_MS);
  const claimed = await prisma.user.updateMany({
    where: { id: userId, lastVoucherGrantedAt: user.lastVoucherGrantedAt },
    data: { voucherExpiresAt: expiresAt, lastVoucherGrantedAt: now },
  });
  if (claimed.count === 0) {
    // Lost the race to another concurrent poll — read back whatever it did.
    const fresh = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { voucherExpiresAt: true },
    });
    return { active: isVoucherActive(fresh.voucherExpiresAt, now), expiresAt: fresh.voucherExpiresAt, justGranted: false };
  }

  return { active: true, expiresAt, justGranted: true };
}
