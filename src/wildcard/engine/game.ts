import type { Card, Color } from "./cards";
import { cardScore, freshDeck, isNumber, shuffle } from "./cards";
import { canPlay } from "./rules";

export type Seat = 0 | 1 | 2 | 3;
export const HUMAN_SEAT: Seat = 0;
export const SEAT_NAME: Record<Seat, string> = { 0: "You", 1: "West", 2: "North", 3: "East" };

const HAND_SIZE = 7;
const DEFAULT_TARGET = 500;
export const UNO_PENALTY = 2; // cards drawn for not declaring "last card!"

export type Phase = "playing" | "handComplete" | "gameOver";

export interface HandResult {
  handNumber: number;
  winner: Seat;
  points: number;                 // what the winner scored
  leftover: { seat: Seat; cards: number; value: number }[];
}

export interface GameState {
  phase: Phase;
  hands: Card[][];        // 4 players
  drawPile: Card[];
  discard: Card[];        // top = last element
  turn: Seat;
  direction: 1 | -1;
  activeColor: Color;     // current color to match (set by wilds)
  drawn: { seat: Seat; cardId: number } | null; // just-drawn playable card awaiting play/keep
  scores: number[];       // cumulative, per seat
  targetScore: number;
  handNumber: number;
  dealer: Seat;
  lastHandResult: HandResult | null;
  winner: Seat | null;    // game winner
  lastAction: string;     // one-line description for the UI message strip
}

const next = (s: Seat, dir: 1 | -1, steps = 1): Seat =>
  (((s + dir * steps) % 4) + 4) % 4 as Seat;

export function topCard(state: GameState): Card {
  return state.discard[state.discard.length - 1];
}

export function newGame(rng: () => number = Math.random, targetScore = DEFAULT_TARGET): GameState {
  const base: GameState = {
    phase: "playing",
    hands: [[], [], [], []],
    drawPile: [],
    discard: [],
    turn: 1,
    direction: 1,
    activeColor: "R",
    drawn: null,
    scores: [0, 0, 0, 0],
    targetScore,
    handNumber: 0,
    dealer: 0,
    lastHandResult: null,
    winner: null,
    lastAction: "",
  };
  return startHand(base, rng);
}

/** Deal 7 to each seat; flip cards until a NUMBER starts the discard
 *  (action/wild flips go back under the pile — the common house simplification). */
export function startHand(state: GameState, rng: () => number = Math.random): GameState {
  let pile = shuffle(freshDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < HAND_SIZE; i++) for (let s = 0; s < 4; s++) hands[s].push(pile.pop()!);

  const discard: Card[] = [];
  for (;;) {
    const flip = pile.pop()!;
    if (isNumber(flip)) { discard.push(flip); break; }
    pile = [flip, ...pile]; // tuck non-number under the pile
  }

  return {
    ...state,
    phase: "playing",
    hands,
    drawPile: pile,
    discard,
    turn: next(state.dealer, 1),
    direction: 1,
    activeColor: discard[0].color!,
    drawn: null,
    handNumber: state.handNumber + 1,
    lastHandResult: null,
    lastAction: "",
  };
}

/** Draw `n` cards for a seat, reshuffling the discard (minus its top) into the
 *  pile if it runs dry. Returns the drawn cards. Mutates copies, not inputs. */
function drawInto(
  hands: Card[][], drawPile: Card[], discard: Card[], seat: Seat, n: number,
  rng: () => number,
): Card[] {
  const got: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (drawPile.length === 0) {
      if (discard.length <= 1) break; // nothing left anywhere — draw what we can
      const top = discard.pop()!;
      drawPile.push(...shuffle(discard.splice(0), rng));
      discard.push(top);
    }
    const c = drawPile.pop()!;
    hands[seat] = [...hands[seat], c];
    got.push(c);
  }
  return got;
}

export interface PlayOpts {
  chosenColor?: Color;   // required when playing a wild
  declareLast?: boolean; // "last card!" — avoids the penalty when playing to 1
}

/**
 * Play a card. Applies skip/reverse/draw effects, the "last card" penalty,
 * hand scoring, and turn advancement. Wilds must arrive with `chosenColor`
 * (the UI shows a picker before calling; bots pick their own).
 */
export function playCard(
  state: GameState, seat: Seat, cardId: number, opts: PlayOpts = {},
  rng: () => number = Math.random,
): GameState {
  if (state.phase !== "playing") throw new Error("not playing");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);
  const card = state.hands[seat].find((c) => c.id === cardId);
  if (!card) throw new Error("card not in hand");
  const top = topCard(state);
  if (!canPlay(card, top.kind, state.activeColor)) throw new Error("illegal play");
  if ((card.kind === "wild" || card.kind === "wild4") && !opts.chosenColor) {
    throw new Error("wild needs a chosen color");
  }

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== cardId) : h.slice()));
  const drawPile = state.drawPile.slice();
  const discard = [...state.discard, card];
  const activeColor = (opts.chosenColor ?? card.color)!;
  let direction = state.direction;
  let lastAction = `${SEAT_NAME[seat]} played ${card.color ?? activeColor} ${String(card.kind)}`;

  // Hand finished?
  if (hands[seat].length === 0) {
    return scoreHand({ ...state, hands, drawPile, discard, activeColor, lastAction }, seat);
  }

  // "Last card!" penalty — down to one card without declaring.
  if (hands[seat].length === 1 && !opts.declareLast) {
    drawInto(hands, drawPile, discard, seat, UNO_PENALTY, rng);
    lastAction = `${SEAT_NAME[seat]} forgot to call last card — drew ${UNO_PENALTY}`;
  } else if (hands[seat].length === 1) {
    lastAction = `${SEAT_NAME[seat]}: “Last card!”`;
  }

  // Card effects → who acts next.
  let turn: Seat;
  switch (card.kind) {
    case "skip":
      turn = next(seat, direction, 2);
      break;
    case "reverse":
      direction = (direction * -1) as 1 | -1;
      turn = next(seat, direction, 1);
      break;
    case "draw2": {
      const victim = next(seat, direction, 1);
      drawInto(hands, drawPile, discard, victim, 2, rng);
      lastAction += ` — ${SEAT_NAME[victim]} draws 2`;
      turn = next(seat, direction, 2);
      break;
    }
    case "wild4": {
      const victim = next(seat, direction, 1);
      drawInto(hands, drawPile, discard, victim, 4, rng);
      lastAction += ` — ${SEAT_NAME[victim]} draws 4`;
      turn = next(seat, direction, 2);
      break;
    }
    default:
      turn = next(seat, direction, 1);
  }

  return {
    ...state, hands, drawPile, discard, activeColor, direction, turn,
    drawn: null, lastAction,
  };
}

/**
 * Draw one card. If it is playable the turn does NOT advance — `drawn` is set
 * and the player chooses `playDrawn` or `keepDrawn`. Otherwise play passes on.
 */
export function drawCard(state: GameState, seat: Seat, rng: () => number = Math.random): GameState {
  if (state.phase !== "playing") throw new Error("not playing");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);
  if (state.drawn) throw new Error("already drew this turn");

  const hands = state.hands.map((h) => h.slice());
  const drawPile = state.drawPile.slice();
  const discard = state.discard.slice();
  const got = drawInto(hands, drawPile, discard, seat, 1, rng);

  if (got.length === 0) {
    // Deck fully exhausted — forced pass.
    return {
      ...state, turn: next(seat, state.direction, 1),
      lastAction: `${SEAT_NAME[seat]} passes (deck empty)`,
    };
  }

  const card = got[0];
  const playable = canPlay(card, topCard(state).kind, state.activeColor);
  if (playable) {
    return {
      ...state, hands, drawPile, discard,
      drawn: { seat, cardId: card.id },
      lastAction: `${SEAT_NAME[seat]} drew a card`,
    };
  }
  return {
    ...state, hands, drawPile, discard,
    turn: next(seat, state.direction, 1),
    drawn: null,
    lastAction: `${SEAT_NAME[seat]} drew and passed`,
  };
}

/** Play the just-drawn card (must be the pending one). */
export function playDrawn(
  state: GameState, seat: Seat, opts: PlayOpts = {}, rng: () => number = Math.random,
): GameState {
  if (!state.drawn || state.drawn.seat !== seat) throw new Error("no drawn card pending");
  const id = state.drawn.cardId;
  return playCard({ ...state, drawn: null }, seat, id, opts, rng);
}

/** Keep the just-drawn card and pass the turn. */
export function keepDrawn(state: GameState, seat: Seat): GameState {
  if (!state.drawn || state.drawn.seat !== seat) throw new Error("no drawn card pending");
  return {
    ...state, drawn: null,
    turn: next(seat, state.direction, 1),
    lastAction: `${SEAT_NAME[seat]} kept the drawn card`,
  };
}

function scoreHand(state: GameState, winner: Seat): GameState {
  const leftover = ([0, 1, 2, 3] as Seat[]).map((s) => ({
    seat: s,
    cards: state.hands[s].length,
    value: state.hands[s].reduce((sum, c) => sum + cardScore(c), 0),
  }));
  const points = leftover.reduce((sum, l) => sum + l.value, 0);
  const scores = state.scores.slice();
  scores[winner] += points;

  const gameOver = scores[winner] >= state.targetScore;
  return {
    ...state,
    phase: gameOver ? "gameOver" : "handComplete",
    scores,
    drawn: null,
    lastHandResult: { handNumber: state.handNumber, winner, points, leftover },
    winner: gameOver ? winner : null,
    dealer: next(state.dealer, 1),
    lastAction: `${SEAT_NAME[winner]} wins the hand (+${points})`,
  };
}

export function dealNextHand(state: GameState, rng: () => number = Math.random): GameState {
  if (state.phase !== "handComplete") throw new Error("hand not complete");
  return startHand(state, rng);
}

/** Total cards in play (pile + discard + hands) — invariant: always 108. */
export function totalCards(state: GameState): number {
  return state.drawPile.length + state.discard.length
    + state.hands.reduce((s, h) => s + h.length, 0);
}
