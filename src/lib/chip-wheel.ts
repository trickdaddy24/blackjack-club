// Chip wheel — the pure half. A free daily spin, weighted toward small
// payouts with one rare jackpot slice. Unlike the property bonus (pick a
// card, own payout curve per pick), this is a single wheel with no choice —
// the "spin and see" mechanic real chip wheels use. Weighting comes from
// segment repetition (a classic wheel-of-fortune trick) rather than a
// weighted-random roll, so a plain uniform pick over the segment list is
// already correctly weighted.

import type { Rng } from "./blackjack/engine";

const defaultRng: Rng = () => Math.random();

export interface WheelSegment {
  value: number;
  jackpot: boolean;
}

export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { value: 150, jackpot: false },
  { value: 150, jackpot: false },
  { value: 150, jackpot: false },
  { value: 150, jackpot: false },
  { value: 150, jackpot: false },
  { value: 150, jackpot: false },
  { value: 300, jackpot: false },
  { value: 300, jackpot: false },
  { value: 300, jackpot: false },
  { value: 300, jackpot: false },
  { value: 300, jackpot: false },
  { value: 450, jackpot: false },
  { value: 450, jackpot: false },
  { value: 450, jackpot: false },
  { value: 450, jackpot: false },
  { value: 750, jackpot: false },
  { value: 750, jackpot: false },
  { value: 750, jackpot: false },
  { value: 1500, jackpot: false },
  { value: 7500, jackpot: true },
] as const;

/** Uniform pick over the segment list — repetition already encodes the weighting. */
export function rollSegmentIndex(rng: Rng = defaultRng): number {
  return Math.floor(rng() * WHEEL_SEGMENTS.length);
}

export function segmentAt(index: number): WheelSegment {
  const seg = WHEEL_SEGMENTS[index];
  if (!seg) throw new Error(`no such wheel segment: ${index}`);
  return seg;
}
