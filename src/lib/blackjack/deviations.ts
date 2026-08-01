// The Illustrious 18 — count-based departures from basic strategy.
//
// Don Schlesinger's set of the eighteen index plays that capture most of the
// gain available from varying strategy with the count. Opt-in: basic strategy
// is still the right default, and a player following these without actually
// tracking the count will do *worse* than one who ignores them.
//
// Each entry says: in this exact spot, take `action` instead of basic strategy
// once the Hi-Lo true count reaches `index` (or, for `below` entries, once it
// drops to `index` or lower). Indices are the standard published values for a
// 6-deck, S17, DAS shoe — the same table the rest of the advisor assumes.
//
// Insurance is the single most valuable index play in the set and the only one
// that isn't a hard/pair decision, which is why it's expressed separately.

import { cardValue, handValue, type Card, type PlayerAction } from "./engine";

export type DeviationAction = "stand" | "hit" | "double" | "split" | "insurance-yes";

export interface Deviation {
  /** 1-based rank in the Illustrious 18, in Schlesinger's value order. */
  rank: number;
  /** Player total, or "pair-10"/"insurance" for the non-total entries. */
  spot: string;
  /** Dealer upcard value, A = 11. `0` for insurance (any upcard by definition). */
  upcard: number;
  /** Hi-Lo true count threshold. */
  index: number;
  /** "at-or-above" fires when tc >= index; "at-or-below" when tc <= index. */
  direction: "at-or-above" | "at-or-below";
  action: DeviationAction;
  /** What basic strategy would have said — used to explain the departure. */
  basic: string;
}

export const ILLUSTRIOUS_18: Deviation[] = [
  { rank: 1,  spot: "insurance", upcard: 0,  index: 3,  direction: "at-or-above", action: "insurance-yes", basic: "decline" },
  { rank: 2,  spot: "16",        upcard: 10, index: 0,  direction: "at-or-above", action: "stand",         basic: "hit" },
  { rank: 3,  spot: "15",        upcard: 10, index: 4,  direction: "at-or-above", action: "stand",         basic: "hit" },
  { rank: 4,  spot: "pair-10",   upcard: 5,  index: 5,  direction: "at-or-above", action: "split",         basic: "stand" },
  { rank: 5,  spot: "pair-10",   upcard: 6,  index: 4,  direction: "at-or-above", action: "split",         basic: "stand" },
  { rank: 6,  spot: "10",        upcard: 10, index: 4,  direction: "at-or-above", action: "double",        basic: "hit" },
  { rank: 7,  spot: "12",        upcard: 3,  index: 2,  direction: "at-or-above", action: "stand",         basic: "hit" },
  { rank: 8,  spot: "12",        upcard: 2,  index: 3,  direction: "at-or-above", action: "stand",         basic: "hit" },
  { rank: 9,  spot: "11",        upcard: 11, index: 1,  direction: "at-or-above", action: "double",        basic: "hit" },
  { rank: 10, spot: "9",         upcard: 2,  index: 1,  direction: "at-or-above", action: "double",        basic: "hit" },
  { rank: 11, spot: "10",        upcard: 11, index: 4,  direction: "at-or-above", action: "double",        basic: "hit" },
  { rank: 12, spot: "9",         upcard: 7,  index: 3,  direction: "at-or-above", action: "double",        basic: "hit" },
  { rank: 13, spot: "16",        upcard: 9,  index: 5,  direction: "at-or-above", action: "stand",         basic: "hit" },
  { rank: 14, spot: "13",        upcard: 2,  index: -1, direction: "at-or-below", action: "hit",           basic: "stand" },
  { rank: 15, spot: "12",        upcard: 4,  index: 0,  direction: "at-or-below", action: "hit",           basic: "stand" },
  { rank: 16, spot: "12",        upcard: 5,  index: -2, direction: "at-or-below", action: "hit",           basic: "stand" },
  { rank: 17, spot: "12",        upcard: 6,  index: -1, direction: "at-or-below", action: "hit",           basic: "stand" },
  { rank: 18, spot: "13",        upcard: 3,  index: -2, direction: "at-or-below", action: "hit",           basic: "stand" },
];

function fires(d: Deviation, trueCount: number): boolean {
  return d.direction === "at-or-above" ? trueCount >= d.index : trueCount <= d.index;
}

/** The insurance index play, kept separate — it's the only non-total entry. */
export function insuranceDeviation(trueCount: number): Deviation | null {
  const d = ILLUSTRIOUS_18[0];
  return fires(d, trueCount) ? d : null;
}

/**
 * The deviation that applies to this exact hand, or null.
 *
 * `actions` is consulted so a deviation is never suggested when the table
 * won't allow it — recommending a double the player can't take would be worse
 * than saying nothing. Pairs of 10s are checked before the hard total, since
 * "split" and "stand on 20" are the same two cards.
 */
export function deviationFor(
  cards: Card[],
  upcard: Card,
  trueCount: number,
  actions: PlayerAction[]
): Deviation | null {
  const up = cardValue(upcard);
  const { total, soft } = handValue(cards);
  // Every Illustrious 18 hand decision is a hard total (or a pair of 10s);
  // none of them apply to soft hands.
  if (soft) return null;

  const isPairOfTens =
    cards.length === 2 &&
    cardValue(cards[0]) === 10 &&
    cardValue(cards[1]) === 10;

  for (const d of ILLUSTRIOUS_18) {
    if (d.spot === "insurance") continue;
    if (d.upcard !== up) continue;
    if (d.spot === "pair-10") {
      if (!isPairOfTens) continue;
    } else {
      // A pair of 10s is a hard 20 — it must not match a "10" total entry.
      if (isPairOfTens) continue;
      if (Number(d.spot) !== total) continue;
    }
    if (!fires(d, trueCount)) continue;
    if (!actions.includes(d.action as PlayerAction)) continue;
    return d;
  }
  return null;
}

/** One-line explanation of why the count overrides the book here. */
export function explainDeviation(d: Deviation, trueCount: number): string {
  const tc = trueCount > 0 ? `+${trueCount}` : String(trueCount);
  if (d.spot === "insurance") {
    return `True count ${tc} means the shoe is rich enough in tens that the dealer makes blackjack more than 1 time in 3 — the only time insurance pays.`;
  }
  const dir = d.direction === "at-or-above" ? "ten-rich" : "ten-poor";
  const cmp = d.direction === "at-or-above" ? `≥ +${d.index}` : `≤ ${d.index}`;
  return `Illustrious 18 #${d.rank}: at true count ${cmp} the shoe is ${dir} enough to ${d.action} here instead of the book's ${d.basic}. Running at ${tc}.`;
}
