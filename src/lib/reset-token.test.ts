import { describe, it, expect } from "vitest";
import { generateRawToken, hashToken, isTokenExpired, RESET_TOKEN_TTL_MS } from "./reset-token";

describe("generateRawToken", () => {
  it("produces a 64-char hex string", () => {
    const t = generateRawToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is different every call", () => {
    expect(generateRawToken()).not.toBe(generateRawToken());
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });

  it("never equals the raw input", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).not.toBe(raw);
  });
});

describe("isTokenExpired", () => {
  const now = new Date("2026-07-21T12:00:00Z");

  it("is false before expiry", () => {
    expect(isTokenExpired(new Date(now.getTime() + 1000), now)).toBe(false);
  });

  it("is true at and after expiry", () => {
    expect(isTokenExpired(now, now)).toBe(true);
    expect(isTokenExpired(new Date(now.getTime() - 1000), now)).toBe(true);
  });

  it("TTL is a sane one hour", () => {
    expect(RESET_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });
});
