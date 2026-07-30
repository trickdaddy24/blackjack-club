// Chip wheel — the pure half. A free daily spin, weighted toward small
// payouts with rare jackpot slices. Unlike the property bonus (pick a card,
// own payout curve per pick), this is a single wheel with no choice — the
// "spin and see" mechanic real chip wheels use. Weighting comes from segment
// repetition (a classic wheel-of-fortune trick) rather than a weighted-random
// roll, so a plain uniform pick over the segment list is already correctly
// weighted.
//
// TWO-TIER JACKPOT, PAIRED. Four jackpot slices on a 22-slice face: two MEGA
// and two MINI, each pair sitting exactly opposite its twin (11 apart), and
// the two pairs interleaved so the jackpots are spread almost evenly around
// the wheel:
//
//   MEGA  idx 2  <-> idx 13
//   MINI  idx 8  <-> idx 19
//   order around the face: 2 M / 8 m / 13 M / 19 m — gaps 6, 5, 6, 5
//
// The wheel therefore reads balanced wherever it stops. There is deliberately
// NO 1500 slice any more: it used to be the lone top regular value, and it
// became the second MINI so that the mini tier is paired the way the mega
// tier already was. MINI is half a MEGA so it still reads as a jackpot.
//
//   v0.42.x  21 slices, EV 735.7/spin, 2 jackpot slices  = 9.5%
//   v0.43.0  22 slices, EV 787.5/spin, 3 jackpot slices  = 13.6%
//   v0.44.0  22 slices, EV 804.5/spin, 4 jackpot slices  = 18.2%
//
// Cumulatively +9.4% EV per spin per player per day against the pre-0.43
// wheel — the number to watch if the chip economy starts inflating.
//
// Slice POSITION is cosmetic (the roll is a uniform pick over the list, so
// only the landing spot moves); slice VALUE is not — changing one moves EV
// and the published pay table, which two tests below pin together.

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
  { value: 150, jackpot: false },
  { value: 450, jackpot: false },
  { value: MINI_JACKPOT, jackpot: true, tier: "mini" },
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
