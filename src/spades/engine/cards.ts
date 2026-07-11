// Card model for Spades. Spades is always trump; within a suit, higher rank wins.

export type Suit = "C" | "D" | "H" | "S";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J 12=Q 13=K 14=A

export interface Card {
  suit: Suit;
  rank: Rank;
}

export const SUITS: Suit[] = ["C", "D", "H", "S"];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_LABEL: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};
const SUIT_LABEL: Record<Suit, string> = { C: "♣", D: "♦", H: "♥", S: "♠" };

export function cardId(c: Card): string {
  return `${c.rank}${c.suit}`;
}

export function cardLabel(c: Card): string {
  return `${RANK_LABEL[c.rank]}${SUIT_LABEL[c.suit]}`;
}

export function isRed(c: Card): boolean {
  return c.suit === "D" || c.suit === "H";
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
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
export function deal(rng: () => number = Math.random): Card[][] {
  const deck = shuffle(freshDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < deck.length; i++) hands[i % 4].push(deck[i]);
  return hands.map(sortHand);
}

const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, C: 2, D: 3 };

/** Stable display order: spades first, then by suit, high rank first. */
export function sortHand(hand: Card[]): Card[] {
  return hand.slice().sort((a, b) =>
    SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || b.rank - a.rank);
}
