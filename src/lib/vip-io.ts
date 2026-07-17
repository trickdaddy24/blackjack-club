// VIP tiers IO: lazy, no cron. Whichever request polls status after a
// player's lifetime round count crosses a threshold claims the tier-up via
// a CAS updateMany (same pattern as hotseat-io.ts / property-bonus), so a
// concurrent double-poll can't double-pay the bonus.

import { prisma } from "@/lib/prisma";
import { nextTier, tierByNumber, tierForRounds, type VipTierDef } from "@/lib/vip";

export interface VipStatus {
  tier: VipTierDef;
  next: VipTierDef | null;
  roundsPlayed: number;
  chips: number;
  tieredUp: boolean;
  bonusAwarded: number;
}

export async function getVipStatus(userId: string): Promise<VipStatus> {
  const [roundsPlayed, user] = await Promise.all([
    prisma.round.count({ where: { userId, status: "settled" } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { vipTier: true, chips: true } }),
  ]);

  const earned = tierForRounds(roundsPlayed);
  if (earned.tier <= user.vipTier) {
    return {
      tier: tierByNumber(user.vipTier),
      next: nextTier(user.vipTier),
      roundsPlayed,
      chips: user.chips,
      tieredUp: false,
      bonusAwarded: 0,
    };
  }

  // Claim the tier-up: only the request that sees the still-old vipTier wins.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, vipTier: user.vipTier },
    data: { vipTier: earned.tier, chips: { increment: earned.tierUpBonus } },
  });

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { vipTier: true, chips: true },
  });

  return {
    tier: tierByNumber(fresh.vipTier),
    next: nextTier(fresh.vipTier),
    roundsPlayed,
    chips: fresh.chips,
    tieredUp: claimed.count > 0,
    bonusAwarded: claimed.count > 0 ? earned.tierUpBonus : 0,
  };
}
