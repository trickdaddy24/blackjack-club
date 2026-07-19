import { describe, it, expect } from "vitest";
import { WHEEL_SEGMENTS, rollSegmentIndex, segmentAt } from "./chip-wheel";

function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("WHEEL_SEGMENTS", () => {
  it("has exactly one jackpot slice", () => {
    expect(WHEEL_SEGMENTS.filter((s) => s.jackpot)).toHaveLength(1);
  });

  it("every segment has a positive value", () => {
    for (const s of WHEEL_SEGMENTS) expect(s.value).toBeGreaterThan(0);
  });

  it("keeps the expected value in a comparable band to the property bonus (~800-1000)", () => {
    const ev = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.value, 0) / WHEEL_SEGMENTS.length;
    expect(ev).toBeGreaterThanOrEqual(700);
    expect(ev).toBeLessThanOrEqual(1000);
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
