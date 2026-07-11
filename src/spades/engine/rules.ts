import type { Card, Suit } from "./cards";
import { cardId } from "./cards";
import type { PlayedCard, Seat } from "./types";

/** The suit that must be followed this trick (the lead), or null if leading. */
export function leadSuit(trick: PlayedCard[]): Suit | null {
  return trick.length ? trick[0].card.suit : null;
}

/**
 * Legal plays for `hand` given the current trick and whether spades are broken.
 * Rules enforced:
 *  - Must follow the lead suit if able.
 *  - When LEADING, spades may not be led until "broken" (a spade played on a
 *    prior trick) UNLESS the hand is nothing but spades.
 *  - On any other trick, if void in the lead suit, anything is legal (that spade
 *    also breaks spades — handled by the caller when applying the play).
 */
export function legalPlays(
  hand: Card[],
  trick: PlayedCard[],
  spadesBroken: boolean,
): Card[] {
  const lead = leadSuit(trick);

  if (lead === null) {
    // Leading.
    if (spadesBroken) return hand.slice();
    const nonSpades = hand.filter((c) => c.suit !== "S");
    // Only spades left → forced to lead a spade even if not "broken".
    return nonSpades.length ? nonSpades : hand.slice();
  }

  const following = hand.filter((c) => c.suit === lead);
  return following.length ? following : hand.slice();
}

export function isLegalPlay(
  card: Card,
  hand: Card[],
  trick: PlayedCard[],
  spadesBroken: boolean,
): boolean {
  const legal = legalPlays(hand, trick, spadesBroken);
  return legal.some((c) => cardId(c) === cardId(card));
}

/**
 * Winner of a completed 4-card trick. Highest spade wins; else highest card of
 * the lead suit. Off-suit non-spades cannot win.
 */
export function trickWinner(trick: PlayedCard[]): Seat {
  if (trick.length !== 4) throw new Error("trickWinner needs a complete 4-card trick");
  const lead = trick[0].card.suit;

  const spades = trick.filter((p) => p.card.suit === "S");
  const pool = spades.length ? spades : trick.filter((p) => p.card.suit === lead);

  let best = pool[0];
  for (const p of pool) if (p.card.rank > best.card.rank) best = p;
  return best.seat;
}

/** A play breaks spades if it is a spade played to a trick led by another suit. */
export function playBreaksSpades(card: Card, trick: PlayedCard[]): boolean {
  const lead = leadSuit(trick);
  return card.suit === "S" && lead !== null && lead !== "S";
}
