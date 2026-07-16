import { describe, expect, it } from "vitest";
import {
  isDisposableEmail,
  SlidingWindowLimiter,
  verifyTurnstile,
} from "./registration-guard";

describe("isDisposableEmail", () => {
  it("blocks known disposable domains, case-insensitively", () => {
    expect(isDisposableEmail("bot@mailinator.com")).toBe(true);
    expect(isDisposableEmail("bot@MAILINATOR.COM")).toBe(true);
    expect(isDisposableEmail("bot@yopmail.com")).toBe(true);
  });

  it("allows real domains and tolerates junk", () => {
    expect(isDisposableEmail("kendall@gmail.com")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
    expect(isDisposableEmail("a@b@mailinator.com")).toBe(true); // last @ wins
  });
});

describe("SlidingWindowLimiter", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const l = new SlidingWindowLimiter(3, 1000);
    expect(l.allow("ip", 0)).toBe(true);
    expect(l.allow("ip", 100)).toBe(true);
    expect(l.allow("ip", 200)).toBe(true);
    expect(l.allow("ip", 300)).toBe(false);
  });

  it("slides: old hits expire and free the slot", () => {
    const l = new SlidingWindowLimiter(2, 1000);
    expect(l.allow("ip", 0)).toBe(true);
    expect(l.allow("ip", 500)).toBe(true);
    expect(l.allow("ip", 900)).toBe(false);
    expect(l.allow("ip", 1001)).toBe(true); // hit at t=0 aged out
    expect(l.allow("ip", 1400)).toBe(false); // 500 + 1001 still live
  });

  it("keys are independent", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.allow("a", 0)).toBe(true);
    expect(l.allow("b", 0)).toBe(true);
    expect(l.allow("a", 1)).toBe(false);
  });

  it("a blocked attempt does not extend the window", () => {
    const l = new SlidingWindowLimiter(1, 1000);
    expect(l.allow("ip", 0)).toBe(true);
    expect(l.allow("ip", 999)).toBe(false);
    expect(l.allow("ip", 1001)).toBe(true);
  });
});

describe("verifyTurnstile", () => {
  it("is inert (passes everything) when no secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(await verifyTurnstile(null, null)).toBe(true);
    expect(await verifyTurnstile("anything", "1.2.3.4")).toBe(true);
  });

  it("fails closed when enabled and no token was submitted", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    try {
      expect(await verifyTurnstile(null, "1.2.3.4")).toBe(false);
      expect(await verifyTurnstile("", "1.2.3.4")).toBe(false);
    } finally {
      delete process.env.TURNSTILE_SECRET_KEY;
    }
  });
});
