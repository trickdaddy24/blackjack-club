import type { Card } from "./cards";
import { cardValue } from "./cards";
import { DROP_THRESHOLD, bestMelds } from "./rules";
import type { GameState, Seat } from "./game";

/** Best card to discard: try each, keep whichever leaves the lowest deadwood.
 *  Ties favor discarding the higher-value card (keep flexible low cards). */
export function botChooseDiscard(hand: Card[]): number {
  let best: { id: number; deadwoodValue: number; cardValue: number } | null = null;
  for (const c of hand) {
    const rest = hand.filter((x) => x.id !== c.id);
    const { deadwoodValue } = bestMelds(rest);
    const cv = cardValue(c);
    if (!best || deadwoodValue < best.deadwoodValue || (deadwoodValue === best.deadwoodValue && cv > best.cardValue)) {
      best = { id: c.id, deadwoodValue, cardValue: cv };
    }
  }
  return best!.id;
}

/** Would taking the discard's top card (then discarding optimally) beat drawing blind? */
export function botDecideDraw(state: GameState, seat: Seat): "stock" | "discard" {
  const hand = state.hands[seat];
  if (state.discard.length === 0) return "stock";
  const top = state.discard[state.discard.length - 1];
  const current = bestMelds(hand).deadwoodValue;

  const withTop = [...hand, top];
  let bestAfter = Infinity;
  for (const c of withTop) {
    const rest = withTop.filter((x) => x.id !== c.id);
    bestAfter = Math.min(bestAfter, bestMelds(rest).deadwoodValue);
  }
  return bestAfter < current ? "discard" : "stock";
}

/** Tonk if clean, drop if deadwood is comfortably low, otherwise keep playing. */
export function botShouldDrop(state: GameState, seat: Seat): "tonk" | "drop" | null {
  const { deadwoodValue } = bestMelds(state.hands[seat]);
  if (deadwoodValue === 0) return "tonk";
  if (deadwoodValue <= DROP_THRESHOLD) return "drop";
  return null;
}
