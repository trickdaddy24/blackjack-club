import { describe, it, expect } from "vitest";
import {
  WHEEL_SEGMENTS,
  rollSegmentIndex,
  segmentAt,
  MEGA_JACKPOT,
  MINI_JACKPOT,
} from "./chip-wheel";

function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

const jackpotIndexes = (tier?: "mega" | "mini") =>
  WHEEL_SEGMENTS.reduce<number[]>(
    (acc, s, i) => (s.jackpot && (!tier || s.tier === tier) ? [...acc, i] : acc),
    []
  );

describe("WHEEL_SEGMENTS", () => {
  it("has three jackpot slices: two mega, one mini", () => {
    expect(jackpotIndexes()).toHaveLength(3);
    expect(jackpotIndexes("mega")).toHaveLength(2);
    expect(jackpotIndexes("mini")).toHaveLength(1);
  });

  it("keeps the two mega slices opposite each other", () => {
    const [a, b] = jackpotIndexes("mega");
    const separation = Math.abs(b - a);
    const half = WHEEL_SEGMENTS.length / 2;
    expect(Math.abs(separation - half)).toBeLessThanOrEqual(1);
  });

  it("puts the mini slice between the two mega slices", () => {
    const [a, b] = jackpotIndexes("mega");
    const [mini] = jackpotIndexes("mini");
    expect(mini).toBeGreaterThan(a);
    expect(mini).toBeLessThan(b);
  });

  it("tags every jackpot slice with a tier, and no regular slice", () => {
    for (const s of WHEEL_SEGMENTS) {
      if (s.jackpot) expect(s.tier).toBeDefined();
      else expect(s.tier).toBeUndefined();
    }
  });

  it("pays each tier its own amount, mini below mega", () => {
    expect(MINI_JACKPOT).toBeLessThan(MEGA_JACKPOT);
    for (const i of jackpotIndexes("mega")) expect(WHEEL_SEGMENTS[i].value).toBe(MEGA_JACKPOT);
    for (const i of jackpotIndexes("mini")) expect(WHEEL_SEGMENTS[i].value).toBe(MINI_JACKPOT);
  });

  it("keeps the mini jackpot above the best regular slice, so the tier is visible", () => {
    const bestRegular = Math.max(
      ...WHEEL_SEGMENTS.filter((s) => !s.jackpot).map((s) => s.value)
    );
    expect(MINI_JACKPOT).toBeGreaterThan(bestRegular);
  });

  it("every segment has a positive value", () => {
    for (const s of WHEEL_SEGMENTS) expect(s.value).toBeGreaterThan(0);
  });

  it("keeps the expected value in a comparable band to the property bonus (~800-1000)", () => {
    const ev = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.value, 0) / WHEEL_SEGMENTS.length;
    expect(ev).toBeGreaterThanOrEqual(700);
    expect(ev).toBeLessThanOrEqual(1000);
  });

  // Pinned so a values tweak can't silently drift from the published pay table.
  // If this fails, update /how-to-play and the CHANGELOG in the same commit.
  it("matches the segment count, EV and jackpot odds published on /how-to-play", () => {
    expect(WHEEL_SEGMENTS.length).toBe(22);
    const ev = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.value, 0) / WHEEL_SEGMENTS.length;
    expect(ev).toBeCloseTo(787.5, 4);
    expect(jackpotIndexes().length / WHEEL_SEGMENTS.length).toBeCloseTo(0.1364, 4);

    const counts = new Map<number, number>();
    for (const s of WHEEL_SEGMENTS) counts.set(s.value, (counts.get(s.value) ?? 0) + 1);
    expect(Object.fromEntries(counts)).toEqual({
      150: 6, 300: 5, 450: 4, 750: 3, 1500: 1, [MINI_JACKPOT]: 1, [MEGA_JACKPOT]: 2,
    });
  });
});

describe("rollSegmentIndex", () => {
  it("stays within bounds", () => {
    expect(rollSegmentIndex(seq(0))).toBe(0);
    expect(rollSegmentIndex(seq(0.999999))).toBe(WHEEL_SEGMENTS.length - 1);
  });

  it("is uniform over the index range (no extra weighting beyond repetition)", () => {
    const n = WHEEL_SEGMENTS.length;
    expect(rollSegmentIndex(seq(0.5))).toBe(Math.floor(0.5 * n));
  });
});

describe("segmentAt", () => {
  it("returns the segment at a valid index", () => {
    expect(segmentAt(0)).toEqual(WHEEL_SEGMENTS[0]);
  });

  it("throws for an out-of-range index", () => {
    expect(() => segmentAt(WHEEL_SEGMENTS.length)).toThrow();
    expect(() => segmentAt(-1)).toThrow();
  });
});
