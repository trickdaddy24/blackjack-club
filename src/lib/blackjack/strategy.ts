// Basic-strategy advisor — returns the recommended action for the active
// hand given the dealer upcard, restricted to the legal actions on offer.
//
// Classic: standard 6-deck, dealer-stands-all-17s, double-after-split table.
// Spanish 21: reasonable simplification of the published strategy (the
// missing 10s push it toward more hitting/later standing and uses surrender
// against an ace on hard 16-17).

import {
  cardValue,
  handValue,
  type Card,
  type ClientView,
  type PlayerAction,
  type RoundState,
  type Variant,
} from "./engine";

type Advice = "hit" | "stand" | "double" | "split" | "surrender";

/** Downgrade advice to something legal: double→(hit/stand), split→total, surrender→hit. */
function legalize(
  advice: Advice,
  fallback: "hit" | "stand",
  actions: PlayerAction[]
): PlayerAction {
  if (actions.includes(advice)) return advice;
  if (advice === "double" || advice === "surrender") return fallback;
  return fallback;
}

function classicPairAdvice(rank: number, up: number): Advice | null {
  if (rank === 11 || rank === 8) return "split"; // aces & eights, always
  if (rank === 9) return up <= 6 || up === 8 || up === 9 ? "split" : "stand";
  if (rank === 7) return up <= 7 ? "split" : "hit";
  if (rank === 6) return up <= 6 ? "split" : "hit";
  if (rank === 4) return up === 5 || up === 6 ? "split" : "hit";
  if (rank === 2 || rank === 3) return up <= 7 ? "split" : "hit";
  return null; // 5s and 10s: play as a hard total
}

function classicSoftAdvice(total: number, up: number): { advice: Advice; fallback: "hit" | "stand" } {
  if (total >= 19) return { advice: "stand", fallback: "stand" };
  if (total === 18) {
    if (up >= 3 && up <= 6) return { advice: "double", fallback: "stand" };
    if (up === 2 || up === 7 || up === 8) return { advice: "stand", fallback: "stand" };
    return { advice: "hit", fallback: "hit" };
  }
  if (total === 17) return up >= 3 && up <= 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total >= 15) return up >= 4 && up <= 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  return up >= 5 && up <= 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
}

function classicHardAdvice(total: number, up: number): { advice: Advice; fallback: "hit" | "stand" } {
  if (total >= 17) return { advice: "stand", fallback: "stand" };
  if (total >= 13) return up <= 6 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  if (total === 12) return up >= 4 && up <= 6 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  if (total === 11) return up <= 10 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total === 10) return up <= 9 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total === 9) return up >= 3 && up <= 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  return { advice: "hit", fallback: "hit" };
}

function spanishSoftAdvice(total: number, up: number): { advice: Advice; fallback: "hit" | "stand" } {
  if (total >= 19) return { advice: "stand", fallback: "stand" };
  if (total === 18) {
    if (up >= 4 && up <= 6) return { advice: "double", fallback: "stand" };
    if (up <= 3 || up === 7 || up === 8) return { advice: "stand", fallback: "stand" };
    return { advice: "hit", fallback: "hit" };
  }
  if (total === 17) return up >= 4 && up <= 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total === 16) return up === 5 || up === 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  return { advice: "hit", fallback: "hit" };
}

function spanishHardAdvice(total: number, up: number): { advice: Advice; fallback: "hit" | "stand" } {
  if (total >= 18) return { advice: "stand", fallback: "stand" };
  if (total === 17) return up === 11 ? { advice: "surrender", fallback: "stand" } : { advice: "stand", fallback: "stand" };
  if (total === 16) {
    if (up === 11) return { advice: "surrender", fallback: "hit" };
    return up <= 6 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  }
  if (total === 15) return up <= 6 && up >= 2 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  if (total === 14) return up >= 4 && up <= 6 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  if (total === 13) return up === 6 ? { advice: "stand", fallback: "stand" } : { advice: "hit", fallback: "hit" };
  if (total === 11) return up <= 9 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total === 10) return up <= 8 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  if (total === 9) return up === 6 ? { advice: "double", fallback: "hit" } : { advice: "hit", fallback: "hit" };
  return { advice: "hit", fallback: "hit" };
}

function spanishPairAdvice(rank: number, up: number): Advice | null {
  if (rank === 11 || rank === 8) return "split";
  if (rank === 9) return (up >= 2 && up <= 6) || up === 8 || up === 9 ? "split" : "stand";
  if (rank === 7) return up <= 7 ? "split" : "hit";
  if (rank === 6) return up >= 4 && up <= 6 ? "split" : "hit";
  if (rank === 2 || rank === 3) return up <= 7 ? "split" : "hit";
  return null;
}

/**
 * Recommended action for the active hand, guaranteed to be one of `actions`.
 * `upcard` is the dealer's face-up card.
 */
export function recommendAction(
  cards: Card[],
  upcard: Card,
  actions: PlayerAction[],
  variant: Variant = "classic"
): PlayerAction | null {
  if (actions.length === 0) return null;
  // Basic strategy never takes insurance — and even money IS insurance
  if (actions.includes("even-money-no")) return "even-money-no";
  if (actions.includes("insurance-no")) return "insurance-no";

  const up = cardValue(upcard); // A = 11
  const spanish = variant === "spanish21";
  const { total, soft } = handValue(cards);

  // Pairs first — only when splitting is actually on offer
  if (actions.includes("split") && cards.length === 2 && cards[0].rank === cards[1].rank) {
    const rank = cardValue(cards[0]);
    const pair = spanish ? spanishPairAdvice(rank, up) : classicPairAdvice(rank, up);
    if (pair === "split") return "split";
    // null / non-split advice: fall through to the total-based tables
  }

  const { advice, fallback } = soft
    ? (spanish ? spanishSoftAdvice : classicSoftAdvice)(total, up)
    : (spanish ? spanishHardAdvice : classicHardAdvice)(total, up);

  return legalize(advice, fallback, actions);
}

/** Attach the basic-strategy hint for the active hand to a client view. */
export function withHint(state: RoundState, view: ClientView): ClientView {
  let hint: PlayerAction | null = null;
  if (state.phase === "insurance") {
    hint = "insurance-no";
  } else if (state.phase === "player") {
    const hand = state.hands[state.active];
    hint = recommendAction(
      hand.cards,
      state.dealer[0],
      view.actions,
      state.variant ?? "classic"
    );
  }
  return { ...view, hint };
}
