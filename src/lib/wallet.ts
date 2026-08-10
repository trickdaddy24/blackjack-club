// Two-wallet chip accounting.
//
// `User.chips` is the main bankroll and backs everything except the Trilux
// table; `User.triluxChips` is a second, independent bankroll used only at
// Room "trilux". They never merge — the only movement between them is an
// explicit transfer (see api/wallet/transfer).
//
// This module is the single place the room→column mapping lives. Money sites
// call `creditData(room, delta)` rather than writing `{ chips: {...} }`
// literals, so adding a third wallet later is one edit here instead of a
// repo-wide grep.
//
// ⚠️ The trap: any code that reads a balance as a MEASURE OF WEALTH — rather
// than as the pot a specific bet draws from — must use `totalWorth()`. Reading
// `user.chips` alone means a player who funds their Trilux bankroll appears
// poorer than they are, which silently drops their High Rollers rank and can
// cost them a VIP tier despite losing nothing.

import type { Room } from "@/lib/blackjack/engine";

/** The two wallets, by the room whose play they back. */
export type WalletField = "chips" | "triluxChips";

/** Which column backs play at this room. */
export function balanceField(room: Room = "classic"): WalletField {
  return room === "trilux" ? "triluxChips" : "chips";
}

/** Minimal shape a balance can be read from — both wallets present. */
export interface WalletBalances {
  chips: number;
  triluxChips: number;
}

/** The balance that play at `room` draws from. */
export function readBalance(user: WalletBalances, room: Room = "classic"): number {
  return room === "trilux" ? user.triluxChips : user.chips;
}

/**
 * A prisma `data` fragment crediting/debiting the wallet that backs `room`.
 * Pass a negative `delta` to debit. Always spread into an update's `data`:
 *
 *   data: { ...creditData(room, chipDelta), winStreak: next }
 */
export function creditData(
  room: Room = "classic",
  delta: number
): { chips: { increment: number } } | { triluxChips: { increment: number } } {
  return room === "trilux"
    ? { triluxChips: { increment: delta } }
    : { chips: { increment: delta } };
}

/**
 * Everything the player owns, across both wallets. Use this — never
 * `user.chips` — anywhere a balance stands in for how rich someone is:
 * High Rollers ranking, VIP tier thresholds, chip-milestone achievements,
 * and any balance shown as a headline net worth.
 */
export function totalWorth(user: WalletBalances): number {
  return user.chips + user.triluxChips;
}

/** Prisma `select` covering both wallets, so callers can't forget one. */
export const WALLET_SELECT = { chips: true, triluxChips: true } as const;
