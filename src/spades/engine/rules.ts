import type { Card, Suit, SpadesRules } from "./cards";
import { cardId, effSuit, isTrump, trumpRank, STANDARD_RULES } from "./cards";
import type { PlayedCard, Seat } from "./types";

/** The suit that must be followed this trick, or null if leading. A trick led
 *  with a promoted deuce counts as a spade lead. */
export function leadSuit(trick: PlayedCard[], rules: SpadesRules = STANDARD_RULES): Suit | null {
  return trick.length ? effSuit(trick[0].card, rules) : null;
}

/**
 * Legal plays for `hand` given the current trick and whether spades are broken.
 * Rules enforced:
 *  - Must follow the lead suit if able (trump/deuces follow as spades).
 *  - When LEADING, spades may not be led until "broken" (a spade played on a
 *    prior trick) UNLESS the hand is nothing but spades.
 *  - On any other trick, if void in the lead suit, anything is legal (that spade
 *    also breaks spades — handled by the caller when applying the play).
 */
export function legalPlays(
  hand: Card[],
  trick: PlayedCard[],
  spadesBroken: boolean,
  rules: SpadesRules = STANDARD_RULES,
): Card[] {
  const lead = leadSuit(trick, rules);

  if (lead === null) {
    // Leading.
    if (spadesBroken) return hand.slice();
    const nonTrump = hand.filter((c) => !isTrump(c, rules));
    // Only trumps left → forced to lead a trump even if not "broken".
    return nonTrump.length ? nonTrump : hand.slice();
  }

  const following = hand.filter((c) => effSuit(c, rules) === lead);
  return following.length ? following : hand.slice();
}

export function isLegalPlay(
  card: Card,
  hand: Card[],
  trick: PlayedCard[],
  spadesBroken: boolean,
  rules: SpadesRules = STANDARD_RULES,
): boolean {
  const legal = legalPlays(hand, trick, spadesBroken, rules);
  return legal.some((c) => cardId(c) === cardId(card));
}

/**
 * Winner of a completed 4-card trick. Highest trump wins (promoted deuces rank
 * above the ace); else highest card of the lead suit. Off-suit non-trumps lose.
 */
export function trickWinner(trick: PlayedCard[], rules: SpadesRules = STANDARD_RULES): Seat {
  if (trick.length !== 4) throw new Error("trickWinner needs a complete 4-card trick");
  const lead = effSuit(trick[0].card, rules);

  const trumps = trick.filter((p) => isTrump(p.card, rules));
  if (trumps.length) {
    let best = trumps[0];
    for (const p of trumps) if (trumpRank(p.card, rules) > trumpRank(best.card, rules)) best = p;
    return best.seat;
  }

  const pool = trick.filter((p) => effSuit(p.card, rules) === lead);
  let best = pool[0];
  for (const p of pool) if (p.card.rank > best.card.rank) best = p;
  return best.seat;
}

/** A play breaks spades if it is a trump played to a trick led by another suit. */
export function playBreaksSpades(
  card: Card,
  trick: PlayedCard[],
  rules: SpadesRules = STANDARD_RULES,
): boolean {
  const lead = leadSuit(trick, rules);
  return isTrump(card, rules) && lead !== null && lead !== "S";
}
