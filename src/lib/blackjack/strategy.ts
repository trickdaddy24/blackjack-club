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

/**
 * One-line plain-English reason behind a recommended action — the teaching
 * half of the hint. Written for the situation, not the rulebook.
 */
export function explainAction(
  cards: Card[],
  upcard: Card,
  action: PlayerAction
): string {
  const up = cardValue(upcard);
  const upName = upcard.rank === "A" ? "ace" : String(up);
  const { total, soft } = handValue(cards);
  const dealerWeak = up >= 2 && up <= 6;

  switch (action) {
    case "insurance-no":
      return "Insurance is a losing bet — the dealer lands blackjack less than 1 time in 3, so it never pays for itself.";
    case "even-money-no":
      return "Play it out: the 3:2 blackjack payout is worth more on average than a locked-in 1:1.";
    case "surrender":
      return `Hard ${total} against a dealer ${upName} loses well over half the time — saving half the bet beats playing it.`;
    case "split": {
      const rank = cardValue(cards[0]);
      if (rank === 11)
        return "A pair of aces as one hand is a weak 12 — split them and each hand starts with an 11 instead.";
      if (rank === 8)
        return "16 is the worst total in blackjack — splitting the 8s trades it for two fresh starts.";
      if (dealerWeak)
        return `The dealer's ${upName} busts often — splitting puts more chips on the table while they're vulnerable.`;
      return `A pair of ${cards[0].rank}s plays better as two separate hands against a ${upName}.`;
    }
    case "double": {
      if (soft)
        return `Soft ${total} can't bust on one card, and the dealer's ${upName} busts often — the perfect double.`;
      return `${total} draws into a strong hand more often than the dealer's ${upName} improves — get extra chips in as the favorite.`;
    }
    case "stand": {
      if (total >= 17)
        return `${soft ? "Soft " : ""}${total} already competes — one more card busts too often to be worth it.`;
      return `The dealer's ${upName} is their weakest upcard — they must keep drawing and bust often. Make them take the risk.`;
    }
    case "hit": {
      if (total <= 11) return `${total} can't bust — the next card is free improvement.`;
      if (soft)
        return `Soft ${total} can't bust on one card — keep improving it against a dealer ${upName}.`;
      return `${total} rarely wins against a dealer ${upName} standing pat — you have to draw even at the risk of busting.`;
    }
    default:
      return "";
  }
}

/** Attach the basic-strategy hint (and its reason) for the active hand to a client view. */
export function withHint(state: RoundState, view: ClientView): ClientView {
  let hint: PlayerAction | null = null;
  let hand = state.hands[state.active] ?? state.hands[0];
  if (state.phase === "insurance") {
    hint = view.actions.includes("even-money-no") ? "even-money-no" : "insurance-no";
  } else if (state.phase === "player") {
    hand = state.hands[state.active];
    hint = recommendAction(
      hand.cards,
      state.dealer[0],
      view.actions,
      state.variant ?? "classic"
    );
  }
  const hintReason =
    hint && hand ? explainAction(hand.cards, state.dealer[0], hint) : null;
  return { ...view, hint, hintReason };
}
