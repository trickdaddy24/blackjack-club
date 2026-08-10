import { describe, expect, it } from "vitest";
import {
  checkTransfer,
  isTransferDirection,
  MAX_TRANSFER,
} from "./transfer";

describe("isTransferDirection", () => {
  it("accepts the two known directions", () => {
    expect(isTransferDirection("to-trilux")).toBe(true);
    expect(isTransferDirection("to-main")).toBe(true);
  });

  it("rejects anything else, including column-name-looking strings", () => {
    for (const v of ["chips", "triluxChips", "", "TO-MAIN", null, undefined, 7, {}]) {
      expect(isTransferDirection(v)).toBe(false);
    }
  });
});

describe("checkTransfer", () => {
  it("accepts a whole-number transfer within balance", () => {
    expect(checkTransfer(500, 10_000)).toEqual({ ok: true });
  });

  it("accepts transferring the entire balance", () => {
    expect(checkTransfer(10_000, 10_000)).toEqual({ ok: true });
  });

  it("rejects overdrawing by even one chip", () => {
    const r = checkTransfer(10_001, 10_000);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not enough/i);
  });

  it("rejects an empty source wallet", () => {
    expect(checkTransfer(1, 0).ok).toBe(false);
  });

  // Zero is a client bug, not a valid no-op — letting it through would write
  // a pointless mutation.
  it("rejects zero", () => {
    const r = checkTransfer(0, 10_000);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/greater than zero/i);
  });

  it("rejects negatives — otherwise 'to-main' of -100 would be a stealth deposit", () => {
    expect(checkTransfer(-100, 10_000).ok).toBe(false);
  });

  // Rounding a fractional amount is how money bugs start; reject outright.
  it("rejects non-integers rather than rounding them", () => {
    expect(checkTransfer(0.5, 10_000).ok).toBe(false);
    expect(checkTransfer(99.99, 10_000).ok).toBe(false);
  });

  it("rejects non-numbers and non-finite values", () => {
    for (const v of ["100", null, undefined, {}, [], NaN, Infinity, -Infinity]) {
      expect(checkTransfer(v, 10_000).ok).toBe(false);
    }
  });

  it("enforces the per-transfer ceiling", () => {
    expect(checkTransfer(MAX_TRANSFER, MAX_TRANSFER + 1).ok).toBe(true);
    expect(checkTransfer(MAX_TRANSFER + 1, MAX_TRANSFER * 2).ok).toBe(false);
  });
});
