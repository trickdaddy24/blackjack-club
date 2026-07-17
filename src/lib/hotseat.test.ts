import { describe, it, expect } from "vitest";
import {
  rollIntervalMs,
  rollAmount,
  pickWinnerIndex,
  HOT_SEAT_MIN_INTERVAL_MS,
  HOT_SEAT_MAX_INTERVAL_MS,
} from "./hotseat";

/** Fake rng that returns a fixed sequence, repeating the last value past the end. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("rollIntervalMs", () => {
  it("stays within [MIN, MAX]", () => {
    expect(rollIntervalMs(seq(0))).toBe(HOT_SEAT_MIN_INTERVAL_MS);
    expect(rollIntervalMs(seq(0.999999))).toBeLessThan(HOT_SEAT_MAX_INTERVAL_MS);
    expect(rollIntervalMs(seq(0.999999))).toBeGreaterThan(HOT_SEAT_MIN_INTERVAL_MS);
  });
});

describe("rollAmount", () => {
  it("gives a base-range amount when the blaze roll misses", () => {
    const amt = rollAmount(seq(0.5, 0.5));
    expect(amt).toBeGreaterThanOrEqual(300);
    expect(amt).toBeLessThanOrEqual(900);
  });

  it("gives a blaze jackpot when the first roll beats the 5% threshold", () => {
    const amt = rollAmount(seq(0.01, 0.5));
    expect(amt).toBeGreaterThanOrEqual(2000);
    expect(amt).toBeLessThanOrEqual(3000);
  });

  it("never rolls a blaze when the first roll is above the threshold", () => {
    for (let i = 0.06; i < 1; i += 0.1) {
      const amt = rollAmount(seq(i, 0));
      expect(amt).toBeLessThanOrEqual(900);
    }
  });
});

describe("pickWinnerIndex", () => {
  it("stays within the pool bounds", () => {
    expect(pickWinnerIndex(5, seq(0))).toBe(0);
    expect(pickWinnerIndex(5, seq(0.999999))).toBe(4);
  });

  it("never picks out of bounds for a pool of one", () => {
    expect(pickWinnerIndex(1, seq(0.5))).toBe(0);
  });
});
