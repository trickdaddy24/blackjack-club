import { describe, it, expect } from "vitest";
import {
  cardId,
  cardLabel,
  deal,
  effSuit,
  freshDeck,
  isJoker,
  isTrump,
  trumpRank,
  STANDARD_RULES,
  type SpadesRules,
} from "./cards";

const JOKER_RULES: SpadesRules = { deucesHigh: false, jokers: true };
const BOTH_RULES: SpadesRules = { deucesHigh: true, jokers: true };

describe("freshDeck", () => {
  it("is a standard 52-card deck without jokers", () => {
    const deck = freshDeck(STANDARD_RULES);
    expect(deck).toHaveLength(52);
    expect(deck.some(isJoker)).toBe(false);
  });

  it("stays at 52 cards with jokers on — swaps in for 2♣/2♦", () => {
    const deck = freshDeck(JOKER_RULES);
    expect(deck).toHaveLength(52);
    expect(deck.filter(isJoker)).toHaveLength(2);
    expect(deck.some((c) => c.suit === "C" && c.rank === 2)).toBe(false);
    expect(deck.some((c) => c.suit === "D" && c.rank === 2)).toBe(false);
    // The other two 2s stay in the deck untouched.
    expect(deck.some((c) => c.suit === "S" && c.rank === 2)).toBe(true);
    expect(deck.some((c) => c.suit === "H" && c.rank === 2)).toBe(true);
  });

  it("has no duplicate cards", () => {
    const deck = freshDeck(JOKER_RULES);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });
});

describe("joker trump semantics", () => {
  const bigJoker = { suit: "JOKER" as const, rank: 21 as const };
  const littleJoker = { suit: "JOKER" as const, rank: 20 as const };
  const aceSpades = { suit: "S" as const, rank: 14 as const };

  it("both jokers are trump", () => {
    expect(isTrump(bigJoker, JOKER_RULES)).toBe(true);
    expect(isTrump(littleJoker, JOKER_RULES)).toBe(true);
  });

  it("jokers follow as spades", () => {
    expect(effSuit(bigJoker, JOKER_RULES)).toBe("S");
    expect(effSuit(littleJoker, JOKER_RULES)).toBe("S");
  });

  it("Big Joker beats Little Joker beats the ace of spades", () => {
    expect(trumpRank(bigJoker, JOKER_RULES)).toBeGreaterThan(trumpRank(littleJoker, JOKER_RULES));
    expect(trumpRank(littleJoker, JOKER_RULES)).toBeGreaterThan(trumpRank(aceSpades, JOKER_RULES));
  });

  it("jokers still outrank promoted deuces when both variants are on", () => {
    const promotedDeuceSpades = { suit: "S" as const, rank: 2 as const };
    expect(trumpRank(littleJoker, BOTH_RULES)).toBeGreaterThan(trumpRank(promotedDeuceSpades, BOTH_RULES));
  });

  it("cardLabel names jokers distinctly", () => {
    expect(cardLabel(bigJoker)).toBe("Big Joker");
    expect(cardLabel(littleJoker)).toBe("Little Joker");
  });
});

describe("deal with jokers", () => {
  it("still deals exactly 13 cards to each of 4 seats", () => {
    const hands = deal(Math.random, JOKER_RULES);
    expect(hands).toHaveLength(4);
    for (const h of hands) expect(h).toHaveLength(13);
  });

  it("both jokers land somewhere across the four hands", () => {
    const hands = deal(Math.random, JOKER_RULES);
    const allCards = hands.flat();
    expect(allCards.filter(isJoker)).toHaveLength(2);
  });
});
