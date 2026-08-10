// Per-table daily claims.
//
// The three once-a-day faucets (flat daily bonus, chip wheel, property pick)
// each have their own "last claimed" timestamp per table, because the Trilux
// bankroll is an independent wallet — sharing the main table's allowance would
// leave it with no organic funding at all, playable only off transfers.
//
// Same shape as lib/wallet.ts: one module owns the room→column mapping so no
// route hardcodes a column name.
//
// ⚠️ `loginStreak` is deliberately NOT per-table. It means "consecutive Vegas
// days this player claimed a daily bonus", which is a property of the player,
// not of a table. It advances on the FIRST daily-bonus claim of a Vegas day at
// either table; the second table's claim that same day still pays, but must not
// advance the streak again. See `shouldAdvanceStreak`.

// Relative imports on purpose: this module is unit-tested, and vitest runs
// without the "@/" path alias (no vitest config in this repo). A type-only
// "@/" import would survive since it erases, but vegasDayKey is a real value.
import type { Room } from "./blackjack/engine";
import { vegasDayKey } from "./leaderboard";

export type ClaimKind = "daily" | "wheel" | "property";

// Generic over the kind so callers get a narrowed column name, not the union
// of all six. Without this, indexing a two-column `select` result by
// claimField(...) is (correctly) a type error.
const FIELDS = {
  classic: {
    daily: "lastDailyBonus",
    wheel: "lastChipWheelSpin",
    property: "lastPropertyPick",
  },
  trilux: {
    daily: "triluxLastDailyBonus",
    wheel: "triluxLastChipWheelSpin",
    property: "triluxLastPropertyPick",
  },
} as const;

/** The `User` column holding a room's last-claimed timestamp, for one kind. */
export type ClaimFieldFor<K extends ClaimKind> =
  | (typeof FIELDS)["classic"][K]
  | (typeof FIELDS)["trilux"][K];

/** Any of the six claim columns. */
export type ClaimField = ClaimFieldFor<ClaimKind>;

/** Which column gates this claim at this table. */
export function claimField<K extends ClaimKind>(
  room: Room = "classic",
  kind: K
): ClaimFieldFor<K> {
  // Branch explicitly rather than indexing FIELDS by a computed room key —
  // the dynamic lookup collapses to the union of both rooms' objects and
  // loses the per-kind narrowing.
  return room === "trilux" ? FIELDS.trilux[kind] : FIELDS.classic[kind];
}

/** Both tables' columns for one claim kind — "did I claim anywhere today". */
export function bothClaimFields<K extends ClaimKind>(
  kind: K
): [ClaimFieldFor<K>, ClaimFieldFor<K>] {
  return [FIELDS.classic[kind], FIELDS.trilux[kind]];
}

/**
 * Has this table's allowance for `kind` already been used today?
 *
 * The flat daily bonus uses a rolling 24h window (matching the existing
 * behaviour), while the wheel and property pick reset on the Vegas calendar
 * day. Keeping both here means the routes don't each re-derive it.
 */
export function alreadyClaimed(
  last: Date | null | undefined,
  kind: ClaimKind,
  now: Date = new Date()
): boolean {
  if (!last) return false;
  if (kind === "daily") {
    return now.getTime() - last.getTime() < 24 * 60 * 60 * 1000;
  }
  return vegasDayKey(last) === vegasDayKey(now);
}

/**
 * Should the account-wide login streak advance for this daily-bonus claim?
 *
 * Only when NEITHER table has already claimed today — otherwise playing both
 * tables would inflate the streak at double speed, and the streak would stop
 * meaning "consecutive days played".
 */
export function shouldAdvanceStreak(
  classicLast: Date | null | undefined,
  triluxLast: Date | null | undefined,
  now: Date = new Date()
): boolean {
  const today = vegasDayKey(now);
  const claimedToday = [classicLast, triluxLast].some(
    (d) => d && vegasDayKey(d) === today
  );
  return !claimedToday;
}

/**
 * The most recent daily-bonus claim across both tables — what the streak's
 * "was yesterday?" comparison should run against, so alternating tables day to
 * day still reads as a continuous run.
 */
export function latestClaim(
  a: Date | null | undefined,
  b: Date | null | undefined
): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}
