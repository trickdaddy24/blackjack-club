import { prisma } from "@/lib/prisma";
import type { RoundState, Variant } from "@/lib/blackjack/engine";

export const MIN_BET = 5;
// Generous table max so "All In" is a real all-in even on a big stack
export const MAX_BET = 1_000_000;
// Perfect Pairs side bet: $1 units, casino-style cap
export const MAX_SIDE_BET = 100;
// Dealer tips: $1 units
export const MAX_TIP = 1000;
export const STARTING_CHIPS = 10000;
export const DAILY_BONUS = 2500;
export const RESCUE_CHIPS = 1000;

// Lucky Ladies progressive: seeded pot, fed by every LL stake, paid in full
// on a Queen of Hearts pair + dealer blackjack, then reseeded.
export const LL_JACKPOT_NAME = "lucky-ladies";
export const LL_JACKPOT_SEED = 25_000;

/** Current Lucky Ladies pot, creating it at the seed on first use. */
export async function getLuckyLadiesJackpot(): Promise<number> {
  const pot = await prisma.jackpot.upsert({
    where: { name: LL_JACKPOT_NAME },
    create: { name: LL_JACKPOT_NAME, amount: LL_JACKPOT_SEED },
    update: {},
    select: { amount: true },
  });
  return pot.amount;
}

/**
 * Feed the pot with this deal's Lucky Ladies stakes and, if a hand hit the
 * progressive, pay the ENTIRE pot to the player and reseed. Returns the
 * jackpot amount won (0 = no hit) and the pot after this round, so callers
 * can credit the player and report the fresh pot in one place.
 */
export async function settleLuckyLadiesPot(
  contribution: number,
  jackpotHit: boolean
): Promise<{ won: number; pot: number }> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.jackpot.upsert({
      where: { name: LL_JACKPOT_NAME },
      create: { name: LL_JACKPOT_NAME, amount: LL_JACKPOT_SEED },
      update: {},
      select: { amount: true },
    });
    const fed = current.amount + contribution;
    const won = jackpotHit ? fed : 0;
    const next = jackpotHit ? LL_JACKPOT_SEED : fed;
    await tx.jackpot.update({
      where: { name: LL_JACKPOT_NAME },
      data: { amount: next },
    });
    return { won, pot: next };
  });
}

export async function getActiveRound(userId: string) {
  return prisma.round.findFirst({
    where: { userId, status: { not: "settled" } },
    orderBy: { createdAt: "desc" },
  });
}

export interface PreviousCarry {
  shoe: RoundState["shoe"];
  variant: Variant;
  runningCount: number;
}

/**
 * Shoe, variant, and Hi-Lo count carried from the player's most recent round.
 * Pre-0.4.0 rounds have no variant/count → classic, 0 (documented in CHANGELOG).
 */
export async function getPreviousCarry(userId: string): Promise<PreviousCarry | null> {
  // Table rounds carry their shoe inside the Table row — solo play must not
  // continue a SHARED shoe (both players would see identical future cards).
  const last = await prisma.round.findFirst({
    where: { userId, tableId: null },
    orderBy: { createdAt: "desc" },
    select: { stateJson: true },
  });
  if (!last) return null;
  try {
    const state = JSON.parse(last.stateJson) as RoundState;
    if (!state.shoe) return null;
    return {
      shoe: state.shoe,
      variant: state.variant ?? "classic",
      runningCount: state.runningCount ?? 0,
    };
  } catch {
    return null;
  }
}

export function parseRoundState(stateJson: string): RoundState {
  return JSON.parse(stateJson) as RoundState;
}


export function roundStatus(state: RoundState): string {
  return state.phase === "settled" ? "settled" : state.phase;
}
