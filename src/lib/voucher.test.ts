import { describe, it, expect } from "vitest";
import {
  VOUCHER_AWAY_MS,
  VOUCHER_WINDOW_MS,
  VOUCHER_BONUS_CAP,
  voucherBonusFor,
  isVoucherActive,
  isAwayLongEnough,
  alreadyGrantedToday,
} from "./voucher";

const NOW = new Date("2026-07-21T12:00:00Z");

describe("voucherBonusFor", () => {
  it("is zero for a loss or push", () => {
    expect(voucherBonusFor(0)).toBe(0);
    expect(voucherBonusFor(-500)).toBe(0);
  });

  it("matches the win below the cap", () => {
    expect(voucherBonusFor(300)).toBe(300);
    expect(voucherBonusFor(VOUCHER_BONUS_CAP)).toBe(VOUCHER_BONUS_CAP);
  });

  it("caps at VOUCHER_BONUS_CAP for a big win", () => {
    expect(voucherBonusFor(50_000)).toBe(VOUCHER_BONUS_CAP);
  });
});

describe("isVoucherActive", () => {
  it("is false when never granted", () => {
    expect(isVoucherActive(null, NOW)).toBe(false);
  });

  it("is true while inside the window", () => {
    expect(isVoucherActive(new Date(NOW.getTime() + 1000), NOW)).toBe(true);
  });

  it("is false once expired", () => {
    expect(isVoucherActive(new Date(NOW.getTime() - 1000), NOW)).toBe(false);
  });
});

describe("isAwayLongEnough", () => {
  it("is false for a brand new player with no settled rounds", () => {
    expect(isAwayLongEnough(null, NOW)).toBe(false);
  });

  it("is false just under the threshold", () => {
    expect(isAwayLongEnough(new Date(NOW.getTime() - VOUCHER_AWAY_MS + 1000), NOW)).toBe(false);
  });

  it("is true exactly at and past the threshold", () => {
    expect(isAwayLongEnough(new Date(NOW.getTime() - VOUCHER_AWAY_MS), NOW)).toBe(true);
    expect(isAwayLongEnough(new Date(NOW.getTime() - VOUCHER_AWAY_MS - 1000), NOW)).toBe(true);
  });
});

describe("alreadyGrantedToday", () => {
  it("is false when never granted", () => {
    expect(alreadyGrantedToday(null, NOW)).toBe(false);
  });

  it("is true for a grant earlier the same Vegas day", () => {
    expect(alreadyGrantedToday(new Date(NOW.getTime() - 60 * 60 * 1000), NOW)).toBe(true);
  });

  it("is false for a grant on a previous Vegas day", () => {
    const yesterday = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    expect(alreadyGrantedToday(yesterday, NOW)).toBe(false);
  });
});

describe("constants", () => {
  it("keeps the window comfortably inside a single away-gap", () => {
    expect(VOUCHER_WINDOW_MS).toBeLessThan(VOUCHER_AWAY_MS);
  });
});
