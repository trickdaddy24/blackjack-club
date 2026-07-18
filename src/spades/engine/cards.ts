// Card model for Spades. Spades is always trump; within a suit, higher rank wins.

export type Suit = "C" | "D" | "H" | "S" | "JOKER";
// 11=J 12=Q 13=K 14=A. 20/21 are Joker sentinels (Little/Big) — always suit
// JOKER, never dealt from the standard 52. Their rank doubles as trumpRank
// (see trumpRank below) so no other function needs to special-case them.
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 20 | 21;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ["C", "D", "H", "S"];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const LITTLE_JOKER: Card = { suit: "JOKER", rank: 20 };
const BIG_JOKER: Card = { suit: "JOKER", rank: 21 };

const RANK_LABEL: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A", 20: "Little Joker", 21: "Big Joker",
};
const SUIT_LABEL: Record<Suit, string> = { C: "♣", D: "♦", H: "♥", S: "♠", JOKER: "🃏" };

export function isJoker(c: Card): boolean {
  return c.suit === "JOKER";
}

export function cardId(c: Card): string {
  return `${c.rank}${c.suit}`;
}

export function cardLabel(c: Card): string {
  if (isJoker(c)) return RANK_LABEL[c.rank];
  return `${RANK_LABEL[c.rank]}${SUIT_LABEL[c.suit]}`;
}

export function isRed(c: Card): boolean {
  return c.suit === "D" || c.suit === "H";
}

/**
 * A standard 52-card deck, or — with `rules.jokers` — the Big and Little
 * Joker swapped in for 2♣/2♦ (the two lowest off-suit cards), keeping the
 * deck at 52 and each hand at 13. Both jokers always rank above the ace of
 * spades (see trumpRank).
 */
export function freshDeck(rules: SpadesRules = STANDARD_RULES): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      if (rules.jokers && rank === 2 && (suit === "C" || suit === "D")) continue;
      deck.push({ suit, rank });
    }
  }
  if (rules.jokers) deck.push(LITTLE_JOKER, BIG_JOKER);
  return deck;
}

/** Fisher–Yates. Accepts an injectable rng for deterministic tests. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal 13 cards to each of 4 seats (indices 0..3). */
export function deal(rng: () => number = Math.random, rules: SpadesRules = STANDARD_RULES): Card[][] {
  const deck = shuffle(freshDeck(rules), rng);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) hands[i % 4].push(deck[i]);
  return hands.map((h) => sortHand(h, rules));
}

// JOKER never surfaces here in practice — effSuit() maps jokers to "S" since
// they're always trump — but the Record must stay total.
const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3, JOKER: 0 };

// ── Rule variants ────────────────────────────────────────────────────────────

/** Toggleable house rules that change card semantics. */
export interface SpadesRules {
  /** "Deuces high": all four 2s become trump (spades), ranked above the A♠. */
  deucesHigh: boolean;
  /** Big + Little Joker replace 2♣/2♦, ranked above everything (incl. deuces). */
  jokers: boolean;
}

export const STANDARD_RULES: SpadesRules = { deucesHigh: false, jokers: false };

/** Order of the promoted deuces, highest first: 2♠ > 2♥ > 2♣ > 2♦. */
const DEUCE_ORDER: Suit[] = ["S", "H", "C", "D"];

/** Is this card trump? Always the spade suit, every 2 when deucesHigh, and
 *  both jokers (they only exist in the deck when rules.jokers is on). */
export function isTrump(c: Card, rules: SpadesRules = STANDARD_RULES): boolean {
  return c.suit === "S" || isJoker(c) || (rules.deucesHigh && c.rank === 2);
}

/** Suit a card counts as for following. A promoted deuce follows as a spade. */
export function effSuit(c: Card, rules: SpadesRules = STANDARD_RULES): Suit {
  return isTrump(c, rules) ? "S" : c.suit;
}

/**
 * Strength of a card *within the trump suit* (only meaningful for trumps).
 * Big Joker=21 > Little Joker=20 > promoted deuces (2♠=19 > 2♥=18 > 2♣=17 >
 * 2♦=16) > A♠=14. Jokers need no special case here: their .rank IS their
 * trumpRank, already above the deuce ceiling. With deucesHigh off, a
 * non-joker card's trumpRank is just its printed rank, so 2♠ = 2.
 */
export function trumpRank(c: Card, rules: SpadesRules = STANDARD_RULES): number {
  if (rules.deucesHigh && c.rank === 2) {
    return 15 + (DEUCE_ORDER.length - DEUCE_ORDER.indexOf(c.suit));
  }
  return c.rank;
}

/** Stable display order: spades (incl. promoted deuces) first, then by suit,
 *  strongest first. */
export function sortHand(hand: Card[], rules: SpadesRules = STANDARD_RULES): Card[] {
  return hand.slice().sort((a, b) => {
    const sa = SUIT_ORDER[effSuit(a, rules)];
    const sb = SUIT_ORDER[effSuit(b, rules)];
    if (sa !== sb) return sa - sb;
    // Within trump, order by trump strength; within a side suit, by rank.
    return effSuit(a, rules) === "S"
      ? trumpRank(b, rules) - trumpRank(a, rules)
      : b.rank - a.rank;
  });
}
