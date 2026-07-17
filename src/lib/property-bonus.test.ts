import { describe, it, expect } from "vitest";
import { PROPERTY_CATALOG, findProperty, rollPropertyAmount } from "./property-bonus";

function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("PROPERTY_CATALOG", () => {
  it("has six properties with unique ids", () => {
    expect(PROPERTY_CATALOG).toHaveLength(6);
    expect(new Set(PROPERTY_CATALOG.map((p) => p.id)).size).toBe(6);
  });

  it("keeps every property's expected value in a comparable band", () => {
    for (const def of PROPERTY_CATALOG) {
      const [lo, hi] = def.base;
      let ev = (lo + hi) / 2;
      if (def.bonusChance) {
        const bonusEv = def.bonusRange
          ? (def.bonusRange[0] + def.bonusRange[1]) / 2
          : ev * (def.bonusMultiplier ?? 1);
        ev = ev * (1 - def.bonusChance) + bonusEv * def.bonusChance;
      }
      expect(ev).toBeGreaterThanOrEqual(800);
      expect(ev).toBeLessThanOrEqual(1000);
    }
  });
});

describe("findProperty", () => {
  it("finds a known property", () => {
    expect(findProperty("wynn")?.name).toBe("Wynn");
  });

  it("returns undefined for an unknown id", () => {
    expect(findProperty("not-a-property")).toBeUndefined();
  });
});

describe("rollPropertyAmount", () => {
  it("stays within the base range when the bonus misses", () => {
    const def = findProperty("mgm-grand")!;
    const { amount, bonusHit } = rollPropertyAmount(def, seq(0.5));
    expect(bonusHit).toBe(false);
    expect(amount).toBeGreaterThanOrEqual(500);
    expect(amount).toBeLessThanOrEqual(1300);
  });

  it("pays the fixed jackpot range when a bonusRange property's bonus hits", () => {
    const def = findProperty("wynn")!;
    const { amount, bonusHit } = rollPropertyAmount(def, seq(0.5, 0.01));
    expect(bonusHit).toBe(true);
    expect(amount).toBe(5000);
  });

  it("never hits the bonus on a property with no bonusChance", () => {
    const def = findProperty("circus-circus")!;
    const { bonusHit } = rollPropertyAmount(def, seq(0, 0));
    expect(bonusHit).toBe(false);
  });

  it("doubles the base roll when a bonusMultiplier property's bonus hits", () => {
    const def = findProperty("the-sphere")!;
    const { amount, bonusHit } = rollPropertyAmount(def, seq(0.5, 0.01));
    expect(bonusHit).toBe(true);
    const expectedBase = Math.floor(250 + 0.5 * (1450 - 250));
    expect(amount).toBe(expectedBase * 2);
  });
});
