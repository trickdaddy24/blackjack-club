import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "./cards";
import { cardValue, freshDeck } from "./cards";
import { bestMelds, canTonk } from "./rules";
import { botChooseDiscard, botDecideDraw, botShouldDrop } from "./bots";
import {
  HUMAN_SEAT, TARGET_PURSE, dealNextHand, discardCard, dropHand,
  drawFromDiscard, drawFromStock, newGame, totalCards,
} from "./game";
import type { GameState, Seat } from "./game";

// Deterministic RNG (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let nextId = 1000;
const C = (suit: Suit, rank: Rank, id = nextId++): Card => ({ id, suit, rank });

/** Build a full playable state from hand-crafted hands (bypasses dealing). */
function mkState(hands: [Card[], Card[], Card[], Card[]], overrides: Partial<GameState> = {}): GameState {
  const used = new Set(hands.flat().map((c) => c.id));
  const rest = freshDeck().filter((c) => !used.has(c.id));
  return {
    phase: "playing",
    hands,
    stock: rest.slice(1),
    discard: [rest[0]],
    turn: 0,
    dealer: 3,
    awaitingDiscard: null,
    turnCount: 0,
    purses: [150, 150, 150, 150],
    handNumber: 1,
    lastHandResult: null,
    outcome: null,
    lastAction: "",
    ...overrides,
  };
}

describe("cards", () => {
  it("builds a unique 52-card deck", () => {
    const deck = freshDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
  });

  it("values aces low and face cards at 10", () => {
    expect(cardValue({ id: 1, suit: "S", rank: 1 })).toBe(1);
    expect(cardValue({ id: 2, suit: "S", rank: 10 })).toBe(10);
    expect(cardValue({ id: 3, suit: "S", rank: 11 })).toBe(10);
    expect(cardValue({ id: 4, suit: "S", rank: 13 })).toBe(10);
  });
});

describe("bestMelds", () => {
  it("finds a same-rank set", () => {
    const hand = [C("S", 7), C("H", 7), C("D", 7), C("C", 2), C("C", 3)];
    const r = bestMelds(hand);
    expect(r.deadwoodValue).toBe(5); // 2 + 3
    expect(r.melds.length).toBe(1);
    expect(r.melds[0].length).toBe(3);
  });

  it("finds a same-suit run", () => {
    const hand = [C("S", 4), C("S", 5), C("S", 6), C("H", 9), C("D", 2)];
    const r = bestMelds(hand);
    expect(r.deadwoodValue).toBe(11); // 9 + 2
  });

  it("recognizes a clean 5-card run as zero deadwood (Tonk)", () => {
    const hand = [C("S", 3), C("S", 4), C("S", 5), C("S", 6), C("S", 7)];
    const r = bestMelds(hand);
    expect(r.deadwoodValue).toBe(0);
    expect(canTonk(hand)).toBe(true);
  });

  it("picks the globally optimal partition, not a greedy one", () => {
    // 5S 6S 7S forms a run; 7S 7H 7D forms a set. Only one can use the 7S.
    // Taking the set (5+6=11 leftover) beats taking the run (7+7=14 leftover).
    const hand = [C("S", 5), C("S", 6), C("S", 7), C("H", 7), C("D", 7)];
    const r = bestMelds(hand);
    expect(r.deadwoodValue).toBe(11);
    expect(r.melds[0].every((c) => c.rank === 7)).toBe(true);
  });

  it("has no melds when nothing matches", () => {
    const hand = [C("S", 2), C("H", 9), C("D", 13), C("C", 5), C("S", 11)];
    const r = bestMelds(hand);
    expect(r.melds.length).toBe(0);
    expect(r.deadwoodValue).toBe(2 + 9 + 10 + 5 + 10);
  });
});

describe("dealing", () => {
  it("deals 5 cards per seat and conserves all 52 cards", () => {
    const s = newGame(rng(1));
    for (const h of s.hands) expect(h.length).toBe(5);
    expect(s.discard.length).toBe(1);
    expect(s.stock.length).toBe(52 - 20 - 1);
    expect(totalCards(s)).toBe(52);
  });

  it("dealNextHand rejects when the hand isn't complete", () => {
    const s = newGame(rng(1));
    expect(() => dealNextHand(s, rng(2))).toThrow();
  });
});

describe("turn flow", () => {
  it("drawing from stock grows the hand and sets awaitingDiscard", () => {
    let s = newGame(rng(4));
    const seat = s.turn;
    const before = s.hands[seat].length;
    s = drawFromStock(s, seat, rng(4));
    expect(s.hands[seat].length).toBe(before + 1);
    expect(s.awaitingDiscard).toBe(seat);
  });

  it("drawing from discard moves the top card into the hand", () => {
    let s = newGame(rng(4));
    const seat = s.turn;
    const top = s.discard[s.discard.length - 1];
    s = drawFromDiscard(s, seat);
    expect(s.hands[seat].some((c) => c.id === top.id)).toBe(true);
    expect(s.discard.length).toBe(0);
  });

  it("discarding returns the hand to 5 and advances the turn", () => {
    let s = newGame(rng(4));
    const seat = s.turn;
    s = drawFromStock(s, seat, rng(4));
    const cardId = s.hands[seat][0].id;
    s = discardCard(s, seat, cardId);
    expect(s.hands[seat].length).toBe(5);
    expect(s.awaitingDiscard).toBeNull();
    expect(s.turn).toBe(((seat + 1) % 4) as Seat);
    expect(totalCards(s)).toBe(52);
  });

  it("rejects acting out of turn or drawing twice", () => {
    let s = newGame(rng(4));
    const seat = s.turn;
    const other = ((seat + 1) % 4) as Seat;
    expect(() => drawFromStock(s, other, rng(4))).toThrow();
    s = drawFromStock(s, seat, rng(4));
    expect(() => drawFromStock(s, seat, rng(4))).toThrow();
    expect(() => discardCard(s, other, s.hands[seat][0].id)).toThrow();
  });
});

describe("dropping and Tonk", () => {
  it("rejects Tonk when the hand has deadwood", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 2), C("H", 9), C("D", 13), C("C", 5), C("S", 11)],
      [C("H", 3), C("H", 4), C("H", 5), C("C", 9), C("C", 10)],
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)],
      [C("C", 3), C("C", 4), C("C", 5), C("H", 9), C("H", 10)],
    ];
    const s = mkState(hands, { turn: 0 });
    expect(() => dropHand(s, 0, "tonk")).toThrow();
  });

  it("pays double on a clean Tonk", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 3), C("S", 4), C("S", 5), C("S", 6), C("S", 7)], // 0 deadwood
      [C("H", 2), C("H", 9), C("D", 13), C("C", 5), C("H", 11)], // 2+9+10+5+10=36
      [C("D", 3), C("D", 4), C("D", 5), C("H", 12), C("H", 13)], // meld 3-4-5, dead 12+13=22
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)],
    ];
    const s = mkState(hands, { turn: 0 });
    const before = s.purses.slice();
    const after = dropHand(s, 0, "tonk");
    expect(after.phase === "handComplete" || after.phase === "gameOver").toBe(true);
    expect(after.lastHandResult!.mode).toBe("tonk");
    expect(after.lastHandResult!.winnerSeat).toBe(0);
    const gained = after.purses[0] - before[0];
    expect(gained).toBeGreaterThan(0);
    // Double the sum of opponents' deadwood values, times the stake multiplier.
    const evals = after.lastHandResult!.evals;
    const expected = evals.filter((e) => e.seat !== 0).reduce((sum, e) => sum + e.deadwoodValue * 2 * 2, 0);
    expect(gained).toBe(expected);
  });

  it("a successful drop collects the deadwood difference from everyone", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 2), C("S", 3), C("S", 4), C("H", 6), C("H", 9)], // meld 2-3-4, dead 6+9=15
      [C("H", 3), C("H", 4), C("H", 5), C("C", 9), C("C", 10)], // meld, dead 19
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)], // meld, dead 19
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)], // meld, dead 19
    ];
    const s = mkState(hands, { turn: 0 });
    const before = s.purses.slice();
    const after = dropHand(s, 0, "drop");
    expect(after.lastHandResult!.mode).toBe("drop");
    expect(after.lastHandResult!.winnerSeat).toBe(0);
    expect(after.purses[0] - before[0]).toBe((19 - 15) * 2 * 3);
    expect(after.purses[1] - before[1]).toBe(-(19 - 15) * 2);
  });

  it("a failed drop pays double to whoever catches it", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 9), C("S", 10), C("H", 2), C("D", 6), C("C", 8)], // no meld, dead 9+10+2+6+8=35
      [C("H", 3), C("H", 4), C("H", 5), C("C", 9), C("C", 2)], // meld, dead 11 (lowest)
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)], // meld, dead 19
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)], // meld, dead 19
    ];
    const s = mkState(hands, { turn: 0 });
    const before = s.purses.slice();
    const after = dropHand(s, 0, "drop");
    expect(after.lastHandResult!.mode).toBe("drop");
    expect(after.lastHandResult!.dropperSeat).toBe(0);
    expect(after.lastHandResult!.winnerSeat).toBe(1); // lowest deadwood catches the drop
    expect(after.purses[0] - before[0]).toBe(-(35 - 11) * 2 * 2);
    expect(after.purses[1] - before[1]).toBe((35 - 11) * 2 * 2);
    expect(after.purses[2]).toBe(before[2]);
    expect(after.purses[3]).toBe(before[3]);
  });
});

describe("stock exhaustion (wash)", () => {
  it("settles by lowest deadwood when the stock and discard both run dry", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 9), C("S", 10), C("H", 2), C("D", 6), C("C", 8)],
      [C("H", 3), C("H", 4), C("H", 5), C("C", 9), C("C", 2)], // lowest
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)],
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)],
    ];
    const s = mkState(hands, { turn: 2, stock: [], discard: [C("H", 8, 9001)] });
    const after = drawFromStock(s, 2);
    expect(after.lastHandResult!.mode).toBe("wash");
    expect(after.lastHandResult!.winnerSeat).toBe(1);
  });
});

describe("purse thresholds", () => {
  it("busts the human when their purse drops to zero or below", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 9), C("S", 10), C("H", 2), C("D", 6), C("C", 8)], // dead 35
      [C("H", 3), C("H", 4), C("H", 5), C("C", 9), C("C", 2)], // dead 11
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)],
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)],
    ];
    const s = mkState(hands, { turn: HUMAN_SEAT, purses: [40, 150, 150, 150] });
    const after = dropHand(s, HUMAN_SEAT, "drop");
    expect(after.phase).toBe("gameOver");
    expect(after.outcome).toBe("busted");
  });

  it("ends the game once the human's purse reaches the target", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 3), C("S", 4), C("S", 5), C("S", 6), C("S", 7)], // 0 deadwood
      [C("H", 2), C("H", 9), C("D", 13), C("C", 5), C("H", 11)],
      [C("D", 3), C("D", 4), C("D", 5), C("H", 12), C("H", 13)],
      [C("C", 3), C("C", 4), C("C", 5), C("D", 9), C("D", 10)],
    ];
    const s = mkState(hands, { turn: HUMAN_SEAT, purses: [250, 150, 150, 150] });
    const after = dropHand(s, HUMAN_SEAT, "tonk");
    expect(after.phase).toBe("gameOver");
    expect(after.outcome).toBe("won");
    expect(after.purses[HUMAN_SEAT]).toBeGreaterThanOrEqual(TARGET_PURSE);
  });
});

describe("bots", () => {
  it("chooses the discard that minimizes remaining deadwood", () => {
    const hand = [C("S", 2), C("S", 3), C("S", 4), C("H", 9), C("D", 13)];
    const id = botChooseDiscard(hand);
    const discarded = hand.find((c) => c.id === id)!;
    expect(discarded.rank).toBe(13); // keeps the run + the 9 (lower resulting deadwood than dropping the 9)
  });

  it("prefers taking a discard that completes a meld", () => {
    const hands: [Card[], Card[], Card[], Card[]] = [
      [C("S", 2), C("H", 9), C("D", 13), C("C", 5), C("S", 11)],
      [C("H", 3), C("H", 4), C("D", 2), C("C", 9), C("C", 10)],
      [C("D", 3), C("D", 4), C("D", 5), C("S", 9), C("S", 10)],
      [C("C", 3), C("C", 4), C("C", 5), C("H", 9), C("H", 10)],
    ];
    const s = mkState(hands, { turn: 1, discard: [C("H", 5, 8001)] });
    expect(botDecideDraw(s, 1)).toBe("discard");
  });

  it("recommends tonk on a clean hand, drop under the threshold, else nothing", () => {
    const stateWith = (hand: Card[]): GameState =>
      ({ hands: [hand, [], [], []] }) as unknown as GameState;

    const clean = [C("S", 3), C("S", 4), C("S", 5), C("S", 6), C("S", 7)]; // 0 deadwood
    expect(botShouldDrop(stateWith(clean), 0)).toBe("tonk");

    const droppable = [C("S", 2), C("S", 3), C("S", 4), C("S", 5), C("H", 1)]; // 4-run + ace, dead 1
    expect(botShouldDrop(stateWith(droppable), 0)).toBe("drop");

    const tooHigh = [C("S", 2), C("S", 3), C("S", 4), C("H", 9), C("D", 1)]; // dead 9+1=10
    expect(botShouldDrop(stateWith(tooHigh), 0)).toBeNull();
  });
});

describe("full seeded games", () => {
  it("bot-driven games terminate and always conserve 52 cards", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const r = rng(seed);
      let s = newGame(r);
      let guard = 0;
      while (s.phase !== "gameOver") {
        if (++guard > 4000) throw new Error(`seed ${seed}: game did not terminate`);
        expect(totalCards(s)).toBe(52);

        if (s.phase === "handComplete") { s = dealNextHand(s, r); continue; }

        const seat = s.awaitingDiscard ?? s.turn;
        if (s.awaitingDiscard !== null) {
          s = discardCard(s, seat, botChooseDiscard(s.hands[seat]));
          continue;
        }
        const drop = botShouldDrop(s, seat);
        if (drop) { s = dropHand(s, seat, drop); continue; }
        const source = botDecideDraw(s, seat);
        s = source === "discard" ? drawFromDiscard(s, seat) : drawFromStock(s, seat, r);
      }
      expect(s.outcome === "won" || s.outcome === "busted").toBe(true);
    }
  });
});
