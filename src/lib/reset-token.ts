// Password-reset tokens — generation and hashing. The raw token rides the
// email link and is never stored; only its sha256 digest lives in the DB
// (PasswordResetToken.tokenHash), so a DB leak alone can't be used to reset
// accounts. Plain sha256 is fine here (unlike password hashing) — the
// secret is already high-entropy random bytes, not a human-chosen value.

import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
