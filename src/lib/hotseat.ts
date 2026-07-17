// Hot Seat drops — the pure half. A random surprise bonus lands on one
// currently-active player every few minutes, Vegas-floor style ("someone's
// chair just got hot"). IO (picking the winner, crediting chips) lives in
// hotseat-io.ts so vitest loads this without Prisma.

import type { Rng } from "./blackjack/engine";

const defaultRng: Rng = () => Math.random();

export const HOT_SEAT_MIN_INTERVAL_MS = 4 * 60 * 1000;
export const HOT_SEAT_MAX_INTERVAL_MS = 12 * 60 * 1000;

// A player counts as "at the table" for HOT_SEAT_ACTIVE_WINDOW_MS after
// their last settled round (or while one is still open).
export const HOT_SEAT_ACTIVE_WINDOW_MS = 3 * 60 * 1000;

const BASE_MIN = 300;
const BASE_MAX = 900;
const BLAZE_CHANCE = 0.05;
const BLAZE_MIN = 2000;
const BLAZE_MAX = 3000;

/** Next drop's delay from now — randomized so it can't be timed/farmed. */
export function rollIntervalMs(rng: Rng = defaultRng): number {
  return Math.floor(
    HOT_SEAT_MIN_INTERVAL_MS + rng() * (HOT_SEAT_MAX_INTERVAL_MS - HOT_SEAT_MIN_INTERVAL_MS)
  );
}

/** The drop amount — usually a modest bump, rarely a "blaze" jackpot-sized hit. */
export function rollAmount(rng: Rng = defaultRng): number {
  if (rng() < BLAZE_CHANCE) {
    return Math.floor(BLAZE_MIN + rng() * (BLAZE_MAX - BLAZE_MIN));
  }
  return Math.floor(BASE_MIN + rng() * (BASE_MAX - BASE_MIN));
}

/** Pick one winner index from an active-player pool of the given size. */
export function pickWinnerIndex(poolSize: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * poolSize);
}
