import { describe, it, expect } from "vitest";
import { fullSet, handPips, isDouble, pips, tileStrength } from "./tiles";
import { applyDraw, applyPlay, legalMoves, newGame, pickOpener } from "./game";
import { botChoosePlay } from "./bots";

function seq(...values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("fullSet", () => {
  it("has 28 unique tiles for a double-6 set", () => {
    const set = fullSet();
    expect(set).toHaveLength(28);
    const ids = new Set(set.map((t) => `${t.a}-${t.b}`));
    expect(ids.size).toBe(28);
  });

  it("has exactly 7 doubles", () => {
    expect(fullSet().filter(isDouble)).toHaveLength(7);
  });
});

describe("pips / handPips / tileStrength", () => {
  it("sums a tile's two numbers", () => {
    expect(pips({ a: 6, b: 4 })).toBe(10);
  });

  it("sums a whole hand", () => {
    expect(handPips([{ a: 6, b: 4 }, { a: 2, b: 0 }])).toBe(12);
  });

  it("ranks by highest number first, then the other", () => {
    expect(tileStrength({ a: 6, b: 4 })).toBeGreaterThan(tileStrength({ a: 6, b: 3 }));
    expect(tileStrength({ a: 6, b: 3 })).toBeGreaterThan(tileStrength({ a: 5, b: 4 }));
  });
});

describe("newGame", () => {
  it("deals 7 tiles to each hand and 14 to the boneyard, minus the opener", () => {
    const state = newGame(Math.random);
    // one tile was already played from the opener's hand
    expect(state.hands[0].length + state.hands[1].length).toBe(13);
    expect(state.boneyard).toHaveLength(14);
    expect(state.board.line).toHaveLength(1);
  });

  it("deals from a genuinely shuffled deck (not the same hand every time)", () => {
    const a = newGame(Math.random);
    const b = newGame(Math.random);
    expect(a.hands[0]).not.toEqual(b.hands[0]);
  });
});

describe("pickOpener", () => {
  it("picks the highest double, whichever hand holds it", () => {
    const hands: [ReturnType<typeof fullSet>, ReturnType<typeof fullSet>] = [
      [{ a: 3, b: 3 }, { a: 2, b: 1 }],
      [{ a: 5, b: 5 }, { a: 6, b: 0 }],
    ];
    const opener = pickOpener(hands);
    expect(opener).toEqual({ seat: 1, index: 0 });
  });

  it("falls back to the single highest-pip tile when neither hand has a double", () => {
    const hands: [ReturnType<typeof fullSet>, ReturnType<typeof fullSet>] = [
      [{ a: 6, b: 3 }, { a: 2, b: 1 }],
      [{ a: 6, b: 4 }, { a: 5, b: 0 }],
    ];
    const opener = pickOpener(hands);
    expect(opener).toEqual({ seat: 1, index: 0 }); // 6-4 outranks 6-3
  });
});

describe("legalMoves", () => {
  it("finds tiles matching either open end", () => {
    const board = { line: [], leftEnd: 4, rightEnd: 4 };
    const hand = [{ a: 4, b: 2 }, { a: 1, b: 1 }, { a: 6, b: 5 }];
    const moves = legalMoves(hand, board);
    expect(moves).toEqual([{ index: 0, end: "left" }, { index: 0, end: "right" }]);
  });

  it("is empty when nothing matches", () => {
    const board = { line: [], leftEnd: 4, rightEnd: 4 };
    const hand = [{ a: 1, b: 1 }, { a: 6, b: 5 }];
    expect(legalMoves(hand, board)).toEqual([]);
  });
});

describe("applyPlay", () => {
  it("extends the matched end and flips the new open value", () => {
    const state = newGame(() => 0);
    const opened = state.board.leftEnd!;
    // Craft a hand for the seat to move that has exactly one legal tile.
    const seat = state.turn;
    const other = seat === 0 ? 1 : 0;
    const playable: { a: number; b: number } = { a: opened, b: (opened + 1) % 7 };
    const hands: [typeof state.hands[0], typeof state.hands[1]] = [state.hands[0], state.hands[1]];
    hands[seat] = [playable, ...hands[seat].slice(1)];
    const rigged = { ...state, hands };

    const next = applyPlay(rigged, seat, 0, "left");
    expect(next.board.leftEnd).toBe(playable.b);
    expect(next.turn).toBe(other);
    expect(next.hands[seat]).toHaveLength(rigged.hands[seat].length - 1);
  });

  it("declares the mover the winner when their hand empties", () => {
    const state = newGame(() => 0);
    const opened = state.board.leftEnd!;
    const seat = state.turn;
    const hands: [typeof state.hands[0], typeof state.hands[1]] = [state.hands[0], state.hands[1]];
    hands[seat] = [{ a: opened, b: (opened + 1) % 7 }]; // exactly one tile left
    const rigged = { ...state, hands };

    const next = applyPlay(rigged, seat, 0, "left");
    expect(next.phase).toBe("roundOver");
    expect(next.outcome).toEqual({ kind: "emptied", winner: seat });
  });

  it("rejects a play out of turn", () => {
    const state = newGame(() => 0);
    const notTurn = state.turn === 0 ? 1 : 0;
    expect(() => applyPlay(state, notTurn, 0, "left")).toThrow();
  });

  it("rejects an illegal tile/end combination", () => {
    const state = newGame(() => 0);
    const seat = state.turn;
    const hands: [typeof state.hands[0], typeof state.hands[1]] = [state.hands[0], state.hands[1]];
    // Guarantee a tile that can't possibly match either open end.
    const opened = { l: state.board.leftEnd!, r: state.board.rightEnd! };
    const junk = [0, 1, 2, 3, 4, 5, 6]
      .flatMap((a) => [0, 1, 2, 3, 4, 5, 6].map((b) => ({ a, b })))
      .find((t) => t.a !== opened.l && t.b !== opened.l && t.a !== opened.r && t.b !== opened.r)!;
    hands[seat] = [junk, ...hands[seat].slice(1)];
    const rigged = { ...state, hands };
    expect(() => applyPlay(rigged, seat, 0, "left")).toThrow();
  });
});

describe("applyDraw", () => {
  it("draws one tile into the drawing seat's hand and keeps their turn", () => {
    const state = newGame(() => 0);
    const seat = state.turn;
    // Force a hand with zero legal moves so a draw is allowed.
    const opened = { l: state.board.leftEnd!, r: state.board.rightEnd! };
    const deadTile = [0, 1, 2, 3, 4, 5, 6]
      .flatMap((a) => [0, 1, 2, 3, 4, 5, 6].map((b) => ({ a, b })))
      .filter((t) => t.a !== opened.l && t.b !== opened.l && t.a !== opened.r && t.b !== opened.r);
    const hands: [typeof state.hands[0], typeof state.hands[1]] = [state.hands[0], state.hands[1]];
    hands[seat] = deadTile.slice(0, hands[seat].length);
    const rigged = { ...state, hands };

    const before = rigged.hands[seat].length;
    const next = applyDraw(rigged, seat);
    expect(next.hands[seat]).toHaveLength(before + 1);
    expect(next.turn).toBe(seat); // still their turn — they need to recheck legality
    expect(next.boneyard).toHaveLength(rigged.boneyard.length - 1);
  });

  it("rejects a draw when a legal play exists", () => {
    const state = newGame(() => 0);
    expect(() => applyDraw(state, state.turn)).toThrow();
  });

  it("passes (not draws) once the boneyard is empty, and blocks after two passes", () => {
    const opened = { l: 3, r: 3 };
    const deadTiles = [0, 1, 2, 3, 4, 5, 6]
      .flatMap((a) => [0, 1, 2, 3, 4, 5, 6].map((b) => ({ a, b })))
      .filter((t) => t.a !== opened.l && t.b !== opened.l);
    const state = {
      phase: "playing" as const,
      hands: [deadTiles.slice(0, 2), deadTiles.slice(2, 4)] as [typeof deadTiles, typeof deadTiles],
      boneyard: [],
      board: { line: [], leftEnd: opened.l, rightEnd: opened.r },
      turn: 0 as const,
      passStreak: 0,
      outcome: null,
    };

    const afterFirstPass = applyDraw(state, 0);
    expect(afterFirstPass.phase).toBe("playing");
    expect(afterFirstPass.turn).toBe(1);
    expect(afterFirstPass.passStreak).toBe(1);

    const afterSecondPass = applyDraw(afterFirstPass, 1);
    expect(afterSecondPass.phase).toBe("roundOver");
    expect(afterSecondPass.outcome?.kind).toBe("block");
  });
});

describe("botChoosePlay", () => {
  it("prefers the heavier/double tile when it has a choice", () => {
    const board = { line: [], leftEnd: 4, rightEnd: 4 };
    const hand = [{ a: 4, b: 1 }, { a: 4, b: 4 }]; // double should win over a light non-double
    const choice = botChoosePlay(hand, board);
    expect(choice?.index).toBe(1);
  });

  it("returns null when nothing is legal", () => {
    const board = { line: [], leftEnd: 4, rightEnd: 4 };
    const hand = [{ a: 1, b: 1 }, { a: 6, b: 5 }];
    expect(botChoosePlay(hand, board)).toBeNull();
  });
});
