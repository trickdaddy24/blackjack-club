import { prisma } from "@/lib/prisma";
import type { RoundState } from "@/lib/blackjack/engine";

export const MIN_BET = 5;
export const MAX_BET = 1000;
export const STARTING_CHIPS = 1000;
export const DAILY_BONUS = 500;
export const RESCUE_CHIPS = 100;

export async function getActiveRound(userId: string) {
  return prisma.round.findFirst({
    where: { userId, status: { not: "settled" } },
    orderBy: { createdAt: "desc" },
  });
}

/** Remaining shoe from the player's most recent round, for shoe continuity. */
export async function getPreviousShoe(userId: string): Promise<RoundState["shoe"] | null> {
  const last = await prisma.round.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { stateJson: true },
  });
  if (!last) return null;
  try {
    const state = JSON.parse(last.stateJson) as RoundState;
    return state.shoe ?? null;
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
