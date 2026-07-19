import { fullSet, handPips, isDouble, shuffle, tileStrength, type Tile } from "./tiles";
import type { Board, End, GameState, Seat } from "./types";

const HAND_SIZE = 7;

function otherSeat(s: Seat): Seat {
  return s === 0 ? 1 : 0;
}

/**
 * Whoever holds the highest double leads with it. If NEITHER hand has any
 * double at all (possible — only 14 of 28 tiles are dealt), the single
 * highest-pip tile across both hands leads instead.
 */
export function pickOpener(hands: [Tile[], Tile[]]): { seat: Seat; index: number } {
  let best: { seat: Seat; index: number; rank: number } | null = null;
  for (const seat of [0, 1] as Seat[]) {
    hands[seat].forEach((t, index) => {
      if (!isDouble(t)) return;
      const rank = t.a; // double value itself, 0..6
      if (!best || rank > best.rank) best = { seat, index, rank };
    });
  }
  if (!best) {
    for (const seat of [0, 1] as Seat[]) {
      hands[seat].forEach((t, index) => {
        const rank = tileStrength(t);
        if (!best || rank > best.rank) best = { seat, index, rank };
      });
    }
  }
  return { seat: best!.seat, index: best!.index };
}

/** Deal a fresh heads-up round: 7 tiles each, 14 in the boneyard, opener led. */
export function newGame(rng: () => number = Math.random): GameState {
  const shuffled = shuffle(fullSet(), rng);
  const hands: [Tile[], Tile[]] = [shuffled.slice(0, HAND_SIZE), shuffled.slice(HAND_SIZE, HAND_SIZE * 2)];
  const boneyard = shuffled.slice(HAND_SIZE * 2);

  const opener = pickOpener(hands);
  const tile = hands[opener.seat][opener.index];
  hands[opener.seat] = hands[opener.seat].filter((_, i) => i !== opener.index);

  // A double naturally has a === b, so this sets both ends to the same
  // value without needing a special case; a non-double just opens with its
  // two different numbers on the two ends (orientation is arbitrary).
  const board: Board = {
    line: [{ tile, seat: opener.seat }],
    leftEnd: tile.a,
    rightEnd: tile.b,
  };

  return {
    phase: "playing",
    hands,
    boneyard,
    board,
    turn: otherSeat(opener.seat),
    passStreak: 0,
    outcome: null,
  };
}

/** Every (tileIndex, end) this hand can legally play right now. */
export function legalMoves(hand: Tile[], board: Board): { index: number; end: End }[] {
  const moves: { index: number; end: End }[] = [];
  hand.forEach((t, index) => {
    if (board.leftEnd !== null && (t.a === board.leftEnd || t.b === board.leftEnd)) {
      moves.push({ index, end: "left" });
    }
    if (board.rightEnd !== null && (t.a === board.rightEnd || t.b === board.rightEnd)) {
      moves.push({ index, end: "right" });
    }
  });
  return moves;
}

function resolveOutcomeOnBlock(hands: [Tile[], Tile[]]): { winner: Seat | "tie" } {
  const p0 = handPips(hands[0]);
  const p1 = handPips(hands[1]);
  if (p0 === p1) return { winner: "tie" };
  return { winner: p0 < p1 ? 0 : 1 };
}

/** Play a tile at the given end for the seat whose turn it is. */
export function applyPlay(state: GameState, seat: Seat, tileIndex: number, end: End): GameState {
  if (state.phase !== "playing") throw new Error("round is over");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);

  const hand = state.hands[seat];
  const tile = hand[tileIndex];
  if (!tile) throw new Error("no such tile in hand");
  const legal = legalMoves(hand, state.board).some((m) => m.index === tileIndex && m.end === end);
  if (!legal) throw new Error("illegal play");

  const nextHand = hand.filter((_, i) => i !== tileIndex);
  const hands: [Tile[], Tile[]] = seat === 0 ? [nextHand, state.hands[1]] : [state.hands[0], nextHand];

  // The end this tile connects to becomes the new open value at that end.
  const newValue = end === "left"
    ? (tile.a === state.board.leftEnd ? tile.b : tile.a)
    : (tile.a === state.board.rightEnd ? tile.b : tile.a);

  const line = end === "left"
    ? [{ tile, seat }, ...state.board.line]
    : [...state.board.line, { tile, seat }];

  const board: Board = {
    line,
    leftEnd: end === "left" ? newValue : state.board.leftEnd,
    rightEnd: end === "right" ? newValue : state.board.rightEnd,
  };

  if (nextHand.length === 0) {
    return {
      ...state,
      hands,
      board,
      phase: "roundOver",
      outcome: { kind: "emptied", winner: seat },
    };
  }

  return { ...state, hands, board, turn: otherSeat(seat), passStreak: 0 };
}

/**
 * Draw one tile from the boneyard for the seat whose turn it is — only
 * legal when they have no playable tile. If the boneyard is already empty,
 * this is instead a pass; two passes in a row (both stuck) blocks the round.
 */
export function applyDraw(state: GameState, seat: Seat): GameState {
  if (state.phase !== "playing") throw new Error("round is over");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);
  if (legalMoves(state.hands[seat], state.board).length > 0) {
    throw new Error("a legal play exists — must play, not draw");
  }

  if (state.boneyard.length === 0) {
    const passStreak = state.passStreak + 1;
    if (passStreak >= 2) {
      return {
        ...state,
        phase: "roundOver",
        outcome: { kind: "block", ...resolveOutcomeOnBlock(state.hands) },
      };
    }
    return { ...state, turn: otherSeat(seat), passStreak };
  }

  const [drawn, ...rest] = state.boneyard;
  const nextHand = [...state.hands[seat], drawn];
  const hands: [Tile[], Tile[]] = seat === 0 ? [nextHand, state.hands[1]] : [state.hands[0], nextHand];
  return { ...state, hands, boneyard: rest, passStreak: 0 };
}
