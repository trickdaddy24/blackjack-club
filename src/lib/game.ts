import { prisma } from "@/lib/prisma";
import type { RoundState, Variant } from "@/lib/blackjack/engine";

export const MIN_BET = 5;
// Generous table max so "All In" is a real all-in even on a big stack
export const MAX_BET = 1_000_000;
export const STARTING_CHIPS = 10000;
export const DAILY_BONUS = 2500;
export const RESCUE_CHIPS = 1000;

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
  const last = await prisma.round.findFirst({
    where: { userId },
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
