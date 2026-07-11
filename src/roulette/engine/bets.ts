import type { BetKind, PlacedBet, PocketId } from "./types";

// Standard roulette payouts, expressed as winnings per unit staked (X:1).
export const PAYOUT: Record<BetKind, number> = {
  straight: 35,
  split: 17,
  street: 11,
  corner: 8,
  basket: 6,   // American five-number (0-00-1-2-3); European "first four" is 8, set per-spot
  sixline: 5,
  column: 2,
  dozen: 2,
  red: 1,
  black: 1,
  even: 1,
  odd: 1,
  low: 1,
  high: 1,
};

export function betWins(numbers: PocketId[], pocket: PocketId): boolean {
  return numbers.includes(pocket);
}

/**
 * Settle placed bets against the spun pocket. A winning bet returns the stake
 * plus winnings (amount * (payout + 1)); a losing bet returns nothing.
 */
export function settle(bets: PlacedBet[], pocket: PocketId): {
  totalStaked: number;
  totalReturn: number;
  net: number;
  winningKeys: string[];
} {
  let totalStaked = 0;
  let totalReturn = 0;
  const winningKeys: string[] = [];
  for (const b of bets) {
    totalStaked += b.amount;
    if (betWins(b.numbers, pocket)) {
      totalReturn += b.amount * (b.payout + 1);
      winningKeys.push(b.spotKey);
    }
  }
  return { totalStaked, totalReturn, net: totalReturn - totalStaked, winningKeys };
}
