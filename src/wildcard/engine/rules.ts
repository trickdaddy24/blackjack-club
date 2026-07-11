import type { Card, Color, Kind } from "./cards";
import { isWild } from "./cards";

/**
 * Can `card` be played on a pile whose top card has `topKind`, given the
 * currently active color (which a wild may have changed)?
 *  - Wilds are always playable.
 *  - Otherwise the card must match the active color OR the top card's kind
 *    (same number, or same symbol — skip on skip, +2 on +2, etc.).
 */
export function canPlay(card: Card, topKind: Kind, activeColor: Color): boolean {
  if (isWild(card)) return true;
  if (card.color === activeColor) return true;
  return card.kind === topKind;
}

export function legalPlays(hand: Card[], topKind: Kind, activeColor: Color): Card[] {
  return hand.filter((c) => canPlay(c, topKind, activeColor));
}
