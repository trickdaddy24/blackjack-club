import { describe, it, expect } from "vitest";
import { spadesClientView } from "./clientView";
import { STANDARD_RULES } from "./cards";
import type { Card } from "./cards";
import type { GameState, HandResult, Seat } from "./types";

// Four distinguishable 13-card hands so a leaked card is easy to spot —
// each seat's cards use a suit no other seat holds any of, at ranks that
// don't collide with anything (a "marked deck" for testing purposes only).
// HAND_0 stops short of the ace (rank 14) — the ace of spades is the card
// already played to the current trick below, so it must NOT also still be
// "in hand" in this fixture (that would make the belt-and-suspenders scan
// below misfire on a card that's legitimately public via currentTrick).
const HAND_0: Card[] = Array.from({ length: 12 }, (_, i) => ({ suit: "S", rank: (2 + i) as Card["rank"] }));
const HAND_1: Card[] = Array.from({ length: 12 }, (_, i) => ({ suit: "H", rank: (2 + i) as Card["rank"] }));
const HAND_2: Card[] = Array.from({ length: 11 }, (_, i) => ({ suit: "D", rank: (2 + i) as Card["rank"] }));
const HAND_3: Card[] = Array.from({ length: 10 }, (_, i) => ({ suit: "C", rank: (2 + i) as Card["rank"] }));

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    rules: STANDARD_RULES,
    hands: [HAND_0, HAND_1, HAND_2, HAND_3],
    bids: [{ tricks: 3, blind: false }, { tricks: 0, blind: false }, { tricks: 4, blind: false }, { tricks: 2, blind: false }],
    tricksWon: [1, 0, 2, 0],
    dealer: 0,
    turn: 1,
    spadesBroken: false,
    currentTrick: [{ seat: 0, card: { suit: "S", rank: 14 } }],
    completedTricks: [
      [
        { seat: 0, card: { suit: "S", rank: 5 } },
        { seat: 1, card: { suit: "H", rank: 5 } },
        { seat: 2, card: { suit: "D", rank: 5 } },
        { seat: 3, card: { suit: "C", rank: 5 } },
      ],
    ],
    teamScores: [{ score: 40, bags: 2 }, { score: 20, bags: 1 }],
    targetScore: 500,
    handNumber: 3,
    lastHandResult: null,
    winner: null,
    ...overrides,
  };
}

const ALL_HANDS = [HAND_0, HAND_1, HAND_2, HAND_3];

describe("spadesClientView — the core security surface", () => {
  it.each([0, 1, 2, 3] as Seat[])(
    "viewer seat %i sees their own cards in full and every other seat only as a count",
    (viewerSeat) => {
      const state = baseState();
      const view = spadesClientView(state, viewerSeat);

      for (const entry of view.hands) {
        if (entry.seat === viewerSeat) {
          expect(entry.cards).not.toBeNull();
          expect(entry.cards).toHaveLength(ALL_HANDS[entry.seat].length);
          // Same cards (order-insensitive — spadesClientView sorts for display).
          const ids = new Set(entry.cards!.map((c) => `${c.rank}${c.suit}`));
          const expected = new Set(ALL_HANDS[entry.seat].map((c) => `${c.rank}${c.suit}`));
          expect(ids).toEqual(expected);
        } else {
          expect(entry.cards).toBeNull();
        }
        expect(entry.cardCount).toBe(ALL_HANDS[entry.seat].length);
      }
    }
  );

  it("never leaks another seat's cards via JSON.stringify — the actual network-tab shape", () => {
    const state = baseState();
    for (const viewerSeat of [0, 1, 2, 3] as Seat[]) {
      const view = spadesClientView(state, viewerSeat);
      const json = JSON.stringify(view);
      const parsed = JSON.parse(json) as typeof view;

      for (const entry of parsed.hands) {
        if (entry.seat !== viewerSeat) {
          expect(entry.cards).toBeNull();
        }
      }

      // Belt-and-suspenders: no OTHER seat's card identifiers appear ANYWHERE
      // in the serialized payload (catches a leak even if it snuck in
      // through some field other than `hands`, e.g. an accidental spread).
      for (const otherSeat of [0, 1, 2, 3] as Seat[]) {
        if (otherSeat === viewerSeat) continue;
        for (const card of ALL_HANDS[otherSeat]) {
          // A card id alone (e.g. "5H") is too ambiguous (ranks/suits recur
          // in public fields like bids), so check for a hand-shaped card
          // object serialization instead.
          const needle = JSON.stringify(card);
          expect(json.includes(needle)).toBe(false);
        }
      }
    }
  });

  it("keeps public information — bids, tricksWon, current trick, team scores — visible to every viewer", () => {
    const state = baseState();
    for (const viewerSeat of [0, 1, 2, 3] as Seat[]) {
      const view = spadesClientView(state, viewerSeat);
      expect(view.bids).toEqual(state.bids);
      expect(view.tricksWon).toEqual(state.tricksWon);
      expect(view.currentTrick).toEqual(state.currentTrick);
      expect(view.teamScores).toEqual(state.teamScores);
      expect(view.completedTrickCount).toBe(1);
      expect(view.dealer).toBe(state.dealer);
      expect(view.turn).toBe(state.turn);
      expect(view.handNumber).toBe(state.handNumber);
    }
  });

  it("does not expose the full contents of completed tricks, only a count", () => {
    const state = baseState();
    const view = spadesClientView(state, 0);
    // completedTrickCount is a number, not the array — there's no field
    // that would carry the actual completed-trick card contents.
    expect(view).not.toHaveProperty("completedTricks");
    expect(view.completedTrickCount).toBe(state.completedTricks.length);
  });

  it("reflects the viewer's own empty hand at end of a hand (0 cards, not null-omitted)", () => {
    const state = baseState({ hands: [[], HAND_1, HAND_2, HAND_3] });
    const view = spadesClientView(state, 0);
    const mine = view.hands.find((h) => h.seat === 0)!;
    expect(mine.cards).toEqual([]);
    expect(mine.cardCount).toBe(0);
  });

  it("carries lastHandResult through untouched (nil results reveal seat/bid/points, never cards)", () => {
    const result: HandResult = {
      handNumber: 2,
      teams: [
        { bidTotal: 3, tricks: 4, points: 30, bagsGained: 1, bagPenalty: 0, nilResults: [] },
        {
          bidTotal: 0,
          tricks: 0,
          points: 100,
          bagsGained: 0,
          bagPenalty: 0,
          nilResults: [{ seat: 1 as Seat, bid: { tricks: 0, blind: false }, made: true, points: 100 }],
        },
      ],
    };
    const state = baseState({ phase: "handComplete", lastHandResult: result });
    const view = spadesClientView(state, 2);
    expect(view.lastHandResult).toEqual(result);
  });
});
