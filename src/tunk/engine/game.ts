import type { Card } from "./cards";
import { freshDeck, shuffle } from "./cards";
import { bestMelds } from "./rules";
import type { MeldSolution } from "./rules";

export type Seat = 0 | 1 | 2 | 3;
export const HUMAN_SEAT: Seat = 0;
export const SEAT_NAME: Record<Seat, string> = { 0: "You", 1: "West", 2: "North", 3: "East" };

const SEATS: Seat[] = [0, 1, 2, 3];
const next1 = (s: Seat): Seat => (((s + 1) % 4) as Seat);

export const HAND_SIZE = 5;
export const START_PURSE = 120;
export const TARGET_PURSE = 300;
const STAKE = 2; // multiplier on every deadwood-difference payout
const MAX_TURNS_PER_HAND = 48; // safety valve — forces a wash if nobody ever drops

export type Phase = "playing" | "handComplete" | "gameOver";
export type DropMode = "tonk" | "drop" | "wash";

export interface SeatEval {
  seat: Seat;
  melds: MeldSolution["melds"];
  deadwood: Card[];
  deadwoodValue: number;
}

export interface HandResult {
  handNumber: number;
  mode: DropMode;
  dropperSeat: Seat | null;
  winnerSeat: Seat;
  evals: SeatEval[];
  purseDeltas: number[];
}

export interface GameState {
  phase: Phase;
  hands: Card[][];          // per seat, 5 cards normally, 6 while awaitingDiscard
  stock: Card[];            // draw pile, top = last element
  discard: Card[];          // discard pile, top = last element
  turn: Seat;
  dealer: Seat;
  awaitingDiscard: Seat | null;
  turnCount: number;        // completed turns this hand — forces a wash past MAX_TURNS_PER_HAND
  purses: number[];
  handNumber: number;
  lastHandResult: HandResult | null;
  outcome: "won" | "busted" | null;
  lastAction: string;
}

function guardTurn(state: GameState, seat: Seat): void {
  if (state.phase !== "playing") throw new Error("hand not in play");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);
  if (state.awaitingDiscard !== null) throw new Error("must discard before acting again");
}

/** Reshuffle the discard pile (minus its top card) back into the stock. Null if nothing to reshuffle. */
function reshuffleStock(state: GameState, rng: () => number): GameState | null {
  if (state.discard.length <= 1) return null;
  const top = state.discard[state.discard.length - 1];
  const rest = state.discard.slice(0, -1);
  return { ...state, stock: shuffle(rest, rng), discard: [top] };
}

function evalHand(state: GameState, seat: Seat): SeatEval {
  const r = bestMelds(state.hands[seat]);
  return { seat, melds: r.melds, deadwood: r.deadwood, deadwoodValue: r.deadwoodValue };
}

/** Settle a hand: tonk/drop resolve against the dropper, wash resolves against the lowest hand. */
function resolveHand(state: GameState, dropperSeat: Seat | null, mode: DropMode): GameState {
  const evals = SEATS.map((s) => evalHand(state, s));
  const minVal = Math.min(...evals.map((e) => e.deadwoodValue));
  const before = state.purses.slice();
  const purses = state.purses.slice();
  let winnerSeat: Seat;
  let lastAction: string;

  if (mode === "wash") {
    winnerSeat = evals.find((e) => e.deadwoodValue === minVal)!.seat;
    for (const e of evals) {
      if (e.seat === winnerSeat) continue;
      const amt = (e.deadwoodValue - minVal) * STAKE;
      purses[e.seat] -= amt;
      purses[winnerSeat] += amt;
    }
    lastAction = `Stock ran dry — ${SEAT_NAME[winnerSeat]} shows the lowest hand.`;
  } else {
    const dropper = dropperSeat as Seat;
    const dropperVal = evals.find((e) => e.seat === dropper)!.deadwoodValue;
    if (dropperVal <= minVal) {
      winnerSeat = dropper;
      const mult = (mode === "tonk" ? 2 : 1) * STAKE;
      for (const e of evals) {
        if (e.seat === dropper) continue;
        const amt = (e.deadwoodValue - dropperVal) * mult;
        purses[e.seat] -= amt;
        purses[dropper] += amt;
      }
      lastAction = mode === "tonk"
        ? `${SEAT_NAME[dropper]} calls Tonk! Clean sweep, double payout.`
        : `${SEAT_NAME[dropper]} drops and wins the hand.`;
    } else {
      const beater = evals
        .filter((e) => e.seat !== dropper)
        .reduce((a, b) => (b.deadwoodValue < a.deadwoodValue ? b : a));
      winnerSeat = beater.seat;
      const penalty = (dropperVal - beater.deadwoodValue) * 2 * STAKE;
      purses[dropper] -= penalty;
      purses[beater.seat] += penalty;
      lastAction = `${SEAT_NAME[dropper]} drops — ${SEAT_NAME[winnerSeat]} catches them! Double penalty.`;
    }
  }

  const purseDeltas = purses.map((p, i) => p - before[i]);
  const humanPurse = purses[HUMAN_SEAT];
  const gameOver = humanPurse <= 0 || humanPurse >= TARGET_PURSE;

  return {
    ...state,
    phase: gameOver ? "gameOver" : "handComplete",
    purses,
    awaitingDiscard: null,
    lastHandResult: { handNumber: state.handNumber, mode, dropperSeat, winnerSeat, evals, purseDeltas },
    outcome: gameOver ? (humanPurse <= 0 ? "busted" : "won") : null,
    lastAction,
  };
}

/** Deal a fresh hand: 5 cards per seat, one card flipped to start the discard. */
export function startHand(state: GameState, rng: () => number = Math.random): GameState {
  const deck = shuffle(freshDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < HAND_SIZE; i++) for (const s of SEATS) hands[s].push(deck.pop()!);
  const discard = [deck.pop()!];

  return {
    ...state,
    phase: "playing",
    hands,
    stock: deck,
    discard,
    turn: next1(state.dealer),
    awaitingDiscard: null,
    turnCount: 0,
    handNumber: state.handNumber + 1,
    lastHandResult: null,
    lastAction: `Hand ${state.handNumber + 1} dealt.`,
  };
}

export function newGame(rng: () => number = Math.random): GameState {
  const base: GameState = {
    phase: "playing",
    hands: [[], [], [], []],
    stock: [],
    discard: [],
    turn: 1,
    dealer: 0,
    awaitingDiscard: null,
    turnCount: 0,
    purses: [START_PURSE, START_PURSE, START_PURSE, START_PURSE],
    handNumber: 0,
    lastHandResult: null,
    outcome: null,
    lastAction: "",
  };
  return startHand(base, rng);
}

export function dealNextHand(state: GameState, rng: () => number = Math.random): GameState {
  if (state.phase !== "handComplete") throw new Error("hand not complete");
  return startHand({ ...state, dealer: next1(state.dealer) }, rng);
}

export function drawFromStock(state: GameState, seat: Seat, rng: () => number = Math.random): GameState {
  guardTurn(state, seat);
  let s = state;
  if (s.stock.length === 0) {
    const reshuffled = reshuffleStock(s, rng);
    if (!reshuffled) return resolveHand(s, null, "wash");
    s = reshuffled;
  }
  const stock = s.stock.slice();
  const card = stock.pop()!;
  const hands = s.hands.map((h, i) => (i === seat ? [...h, card] : h));
  return {
    ...s, stock, hands, awaitingDiscard: seat,
    lastAction: `${SEAT_NAME[seat]} drew from the stock.`,
  };
}

export function drawFromDiscard(state: GameState, seat: Seat): GameState {
  guardTurn(state, seat);
  if (state.discard.length === 0) throw new Error("discard pile is empty");
  const discard = state.discard.slice();
  const card = discard.pop()!;
  const hands = state.hands.map((h, i) => (i === seat ? [...h, card] : h));
  return {
    ...state, discard, hands, awaitingDiscard: seat,
    lastAction: `${SEAT_NAME[seat]} took the discard.`,
  };
}

export function discardCard(state: GameState, seat: Seat, cardId: number): GameState {
  if (state.phase !== "playing") throw new Error("hand not in play");
  if (state.awaitingDiscard !== seat) throw new Error(`seat ${seat} has nothing pending to discard`);
  const card = state.hands[seat].find((c) => c.id === cardId);
  if (!card) throw new Error("card not in hand");

  const hands = state.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== cardId) : h));
  const discard = [...state.discard, card];
  const turnCount = state.turnCount + 1;
  const next = {
    ...state, hands, discard, awaitingDiscard: null, turn: next1(seat), turnCount,
    lastAction: `${SEAT_NAME[seat]} discarded.`,
  };
  return turnCount >= MAX_TURNS_PER_HAND ? resolveHand(next, null, "wash") : next;
}

/** Drop (or call Tonk) at the start of a turn, before drawing. */
export function dropHand(state: GameState, seat: Seat, mode: "tonk" | "drop"): GameState {
  guardTurn(state, seat);
  if (mode === "tonk" && bestMelds(state.hands[seat]).deadwoodValue !== 0) {
    throw new Error("hand isn't clean — can't call Tonk");
  }
  return resolveHand(state, seat, mode);
}

/** Total cards in play — invariant: always 52. */
export function totalCards(state: GameState): number {
  return state.stock.length + state.discard.length + state.hands.reduce((s, h) => s + h.length, 0);
}
