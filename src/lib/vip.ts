// VIP tiers — the pure half. Status is loyalty, not luck: lifetime settled
// rounds played (table time), Caesars-Rewards style. Each tier boosts the
// flat daily bonus and pays a one-time "status match" bonus the moment a
// player crosses the threshold. IO (crediting the tier-up, reading lifetime
// rounds) lives in vip-io.ts so vitest loads this without Prisma.

export interface VipTierDef {
  tier: number;
  name: string;
  badge: string;
  /** Lifetime settled rounds required to reach this tier. */
  threshold: number;
  /** Percent boost applied to the flat daily bonus while at this tier. */
  dailyBonusBoostPct: number;
  /** One-time chip bonus paid the moment a player reaches this tier. */
  tierUpBonus: number;
}

export const VIP_TIERS: readonly VipTierDef[] = [
  { tier: 0, name: "Member", badge: "🎫", threshold: 0, dailyBonusBoostPct: 0, tierUpBonus: 0 },
  { tier: 1, name: "Silver", badge: "🥈", threshold: 100, dailyBonusBoostPct: 5, tierUpBonus: 500 },
  { tier: 2, name: "Gold", badge: "🥇", threshold: 500, dailyBonusBoostPct: 10, tierUpBonus: 1_500 },
  { tier: 3, name: "Platinum", badge: "💠", threshold: 2_000, dailyBonusBoostPct: 20, tierUpBonus: 5_000 },
  { tier: 4, name: "Diamond", badge: "💎", threshold: 5_000, dailyBonusBoostPct: 35, tierUpBonus: 15_000 },
  { tier: 5, name: "Seven Stars", badge: "⭐", threshold: 15_000, dailyBonusBoostPct: 50, tierUpBonus: 50_000 },
] as const;

/** Highest tier whose threshold is met by this many lifetime rounds. */
export function tierForRounds(rounds: number): VipTierDef {
  let best = VIP_TIERS[0];
  for (const def of VIP_TIERS) {
    if (rounds >= def.threshold) best = def;
  }
  return best;
}

export function tierByNumber(tier: number): VipTierDef {
  return VIP_TIERS.find((d) => d.tier === tier) ?? VIP_TIERS[0];
}

/** The next tier up, or null if already at the top. */
export function nextTier(currentTier: number): VipTierDef | null {
  return VIP_TIERS.find((d) => d.tier === currentTier + 1) ?? null;
}
