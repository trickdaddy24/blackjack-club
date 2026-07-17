import { describe, it, expect } from "vitest";
import { VIP_TIERS, tierForRounds, tierByNumber, nextTier } from "./vip";

describe("VIP_TIERS", () => {
  it("is sorted ascending by threshold and tier number", () => {
    for (let i = 1; i < VIP_TIERS.length; i++) {
      expect(VIP_TIERS[i].threshold).toBeGreaterThan(VIP_TIERS[i - 1].threshold);
      expect(VIP_TIERS[i].tier).toBe(VIP_TIERS[i - 1].tier + 1);
    }
  });

  it("starts at Member with no boost or bonus", () => {
    expect(VIP_TIERS[0]).toMatchObject({ name: "Member", threshold: 0, dailyBonusBoostPct: 0, tierUpBonus: 0 });
  });
});

describe("tierForRounds", () => {
  it("stays at Member below the first threshold", () => {
    expect(tierForRounds(0).name).toBe("Member");
    expect(tierForRounds(99).name).toBe("Member");
  });

  it("promotes exactly at a threshold, not one below it", () => {
    expect(tierForRounds(99).name).toBe("Member");
    expect(tierForRounds(100).name).toBe("Silver");
    expect(tierForRounds(499).name).toBe("Silver");
    expect(tierForRounds(500).name).toBe("Gold");
  });

  it("caps at the top tier past its threshold", () => {
    expect(tierForRounds(15_000).name).toBe("Seven Stars");
    expect(tierForRounds(1_000_000).name).toBe("Seven Stars");
  });
});

describe("tierByNumber", () => {
  it("looks up a tier by its number", () => {
    expect(tierByNumber(2).name).toBe("Gold");
  });

  it("falls back to Member for an unknown tier number", () => {
    expect(tierByNumber(99).name).toBe("Member");
  });
});

describe("nextTier", () => {
  it("returns the next tier up", () => {
    expect(nextTier(0)?.name).toBe("Silver");
    expect(nextTier(4)?.name).toBe("Seven Stars");
  });

  it("returns null past the top tier", () => {
    expect(nextTier(5)).toBeNull();
  });
});
