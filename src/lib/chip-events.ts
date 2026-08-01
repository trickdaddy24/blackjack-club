// Out-of-band chip credits — the bridge between the bars and the table HUD.
//
// Chips get credited server-side from a dozen places that aren't a bet or an
// action (hot seat drops, quest rewards, VIP tier-ups, wheel spins, property
// bonuses, board champion prizes, admin grants). The bars that announce those
// are deliberately independent of GameTable, so none of them can reach the
// chip HUD's state — the number would sit frozen until the player's next bet
// quietly overwrote it with a balance that already included the bonus.
//
// So: whoever credits chips shouts, and GameTable listens. The `amount` is an
// optimistic hint for instant feedback only — the listener always reconciles
// against /api/game/chips, so a missed or duplicated event self-corrects.

export const CHIPS_CHANGED_EVENT = "bj:chips-changed";

export interface ChipsChangedDetail {
  /** Optimistic delta for an instant HUD bump. Omit if unknown. */
  amount?: number;
  /** Where the credit came from — for debugging, not display. */
  reason: string;
}

/** Announce that the signed-in player's balance moved outside the bet path. */
export function emitChipsChanged(reason: string, amount?: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChipsChangedDetail>(CHIPS_CHANGED_EVENT, { detail: { amount, reason } })
  );
}

/** Subscribe to credits. Returns the unsubscribe for useEffect cleanup. */
export function onChipsChanged(handler: (detail: ChipsChangedDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<ChipsChangedDetail>).detail);
  window.addEventListener(CHIPS_CHANGED_EVENT, listener);
  return () => window.removeEventListener(CHIPS_CHANGED_EVENT, listener);
}
