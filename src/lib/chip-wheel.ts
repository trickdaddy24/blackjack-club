// Chip wheel — the pure half. A free daily spin, weighted toward small
// payouts with rare jackpot slices. Unlike the property bonus (pick a card,
// own payout curve per pick), this is a single wheel with no choice — the
// "spin and see" mechanic real chip wheels use. Weighting comes from segment
// repetition (a classic wheel-of-fortune trick) rather than a weighted-random
// roll, so a plain uniform pick over the segment list is already correctly
// weighted.
//
// TWO-TIER JACKPOT. The wheel carries two MEGA slices still sitting exactly
// opposite each other (11 apart on a 22-slice face), plus a single MINI slice
// between them. The MEGA pair is unchanged from the previous 21-slice wheel —
// this was an additive change, so the mini slice raises the daily give rather
// than being funded by shrinking the megas:
//
//   before  21 slices, EV 735.7/spin, jackpot slices 2/21 = 9.5%
//   after   22 slices, EV 787.5/spin, jackpot slices 3/22 = 13.6%
//
// That is +7.0% EV per spin per player per day. MINI is set at half a MEGA so
// it still reads as a jackpot rather than a big regular slice — it has to sit
// above the 1500 top regular value or the tiering is invisible to players.

import type { Rng } from "./blackjack/engine";

const defaultRng: Rng = () => Math.random();

/** Which jackpot a jackpot slice is. Absent on regular slices. */
export type JackpotTier = "mega" | "mini";

export const MEGA_JACKPOT = 3750;
export const MINI_JACKPOT = 1875;

export interface WheelSegment {
  value: number;
  jackpot: boolean;
  /** Set only when `jackpot` is true. */
  tier?: JackpotTier;
}

export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { value: 150, jackpot: false },
  { value: 300, jackpot: false },
  { value: MEGA_JACKPOT, jackpot: true, tier: "mega" },
  { value: 450, jackpot: false },
  { value: 150, jackpot: false },
  { value: 750, jackpot: false },
  { value: 300, jackpot: false },
  { value: 150, jackpot: false },
  { value: MINI_JACKPOT, jackpot: true, tier: "mini" },
  { value: 450, jackpot: false },
  { value: 300, jackpot: false },
  { value: 150, jackpot: false },
  { value: 750, jackpot: false },
  { value: MEGA_JACKPOT, jackpot: true, tier: "mega" },
  { value: 450, jackpot: false },
  { value: 150, jackpot: false },
  { value: 300, jackpot: false },
  { value: 1500, jackpot: false },
  { value: 450, jackpot: false },
  { value: 150, jackpot: false },
  { value: 750, jackpot: false },
  { value: 300, jackpot: false },
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
