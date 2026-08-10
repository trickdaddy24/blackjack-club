import { describe, expect, it } from "vitest";
import {
  alreadyClaimed,
  bothClaimFields,
  claimField,
  latestClaim,
  shouldAdvanceStreak,
} from "./claims";

/** Midnight Vegas is 07:00 or 08:00 UTC — mid-afternoon UTC is safely same-day. */
const noon = (iso: string) => new Date(`${iso}T20:00:00Z`);

describe("claimField", () => {
  it("maps each table to its own column, per kind", () => {
    expect(claimField("classic", "daily")).toBe("lastDailyBonus");
    expect(claimField("trilux", "daily")).toBe("triluxLastDailyBonus");
    expect(claimField("classic", "wheel")).toBe("lastChipWheelSpin");
    expect(claimField("trilux", "wheel")).toBe("triluxLastChipWheelSpin");
    expect(claimField("classic", "property")).toBe("lastPropertyPick");
    expect(claimField("trilux", "property")).toBe("triluxLastPropertyPick");
  });

  it("defaults to the main table", () => {
    expect(claimField(undefined, "daily")).toBe("lastDailyBonus");
  });

  it("never returns the same column for both tables", () => {
    for (const kind of ["daily", "wheel", "property"] as const) {
      const [a, b] = bothClaimFields(kind);
      expect(a).not.toBe(b);
    }
  });
});

describe("alreadyClaimed", () => {
  it("is false when never claimed", () => {
    expect(alreadyClaimed(null, "daily")).toBe(false);
    expect(alreadyClaimed(undefined, "wheel")).toBe(false);
  });

  // The flat daily bonus uses a rolling 24h window, matching prior behaviour.
  it("daily: blocks inside 24h, frees after", () => {
    const now = new Date("2026-08-10T20:00:00Z");
    expect(alreadyClaimed(new Date("2026-08-10T02:00:00Z"), "daily", now)).toBe(true);
    expect(alreadyClaimed(new Date("2026-08-09T19:00:00Z"), "daily", now)).toBe(false);
  });

  // Wheel and property reset on the Vegas calendar day, not a rolling window.
  it("wheel/property: block same Vegas day, free the next", () => {
    const now = noon("2026-08-10");
    expect(alreadyClaimed(noon("2026-08-10"), "wheel", now)).toBe(true);
    expect(alreadyClaimed(noon("2026-08-09"), "wheel", now)).toBe(false);
    expect(alreadyClaimed(noon("2026-08-10"), "property", now)).toBe(true);
    expect(alreadyClaimed(noon("2026-08-09"), "property", now)).toBe(false);
  });
});

describe("latestClaim", () => {
  it("picks the more recent of the two tables, tolerating nulls", () => {
    const older = noon("2026-08-08");
    const newer = noon("2026-08-09");
    expect(latestClaim(older, newer)).toBe(newer);
    expect(latestClaim(newer, older)).toBe(newer);
    expect(latestClaim(null, newer)).toBe(newer);
    expect(latestClaim(older, null)).toBe(older);
    expect(latestClaim(null, null)).toBeNull();
  });
});

// The rule that stops two tables inflating an account-wide streak at 2x speed.
describe("shouldAdvanceStreak", () => {
  const now = noon("2026-08-10");

  it("advances on the very first claim ever", () => {
    expect(shouldAdvanceStreak(null, null, now)).toBe(true);
  });

  it("advances when the last claim was a previous day", () => {
    expect(shouldAdvanceStreak(noon("2026-08-09"), null, now)).toBe(true);
  });

  it("does NOT advance again if the main table already claimed today", () => {
    expect(shouldAdvanceStreak(noon("2026-08-10"), null, now)).toBe(false);
  });

  it("does NOT advance again if TRILUX already claimed today", () => {
    expect(shouldAdvanceStreak(null, noon("2026-08-10"), now)).toBe(false);
  });

  it("does not advance when both claimed today", () => {
    expect(shouldAdvanceStreak(noon("2026-08-10"), noon("2026-08-10"), now)).toBe(false);
  });

  // Alternating tables day to day is still one continuous run of days.
  it("keeps advancing across days even when the player alternates tables", () => {
    expect(shouldAdvanceStreak(noon("2026-08-09"), noon("2026-08-08"), now)).toBe(true);
  });
});
