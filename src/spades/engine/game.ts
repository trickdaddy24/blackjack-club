import type { Card } from "./cards";
import { cardId, deal, sortHand } from "./cards";
import {
  isLegalPlay, leadSuit, playBreaksSpades, trickWinner,
} from "./rules";
import { scoreHand } from "./scoring";
import type { Bid, GameState, Seat } from "./types";

export const HUMAN_SEAT: Seat = 0;
const DEFAULT_TARGET = 500;

function nextSeat(s: Seat): Seat {
  return ((s + 1) % 4) as Seat;
}

/** Start a fresh game. `rng` is injectable for deterministic tests. */
export function newGame(rng: () => number = Math.random, targetScore = DEFAULT_TARGET): GameState {
  const dealer: Seat = 0;
  return startHand({
    phase: "bidding",
    hands: [[], [], [], []],
    bids: [null, null, null, null],
    tricksWon: [0, 0, 0, 0],
    dealer,
    turn: nextSeat(dealer),
    spadesBroken: false,
    currentTrick: [],
    completedTricks: [],
    teamScores: [{ score: 0, bags: 0 }, { score: 0, bags: 0 }],
    targetScore,
    handNumber: 0,
    lastHandResult: null,
    winner: null,
  }, rng);
}

/** Deal a new hand and enter the bidding phase. Bidding starts left of dealer. */
export function startHand(state: GameState, rng: () => number = Math.random): GameState {
  const hands = deal(rng);
  return {
    ...state,
    phase: "bidding",
    hands,
    bids: [null, null, null, null],
    tricksWon: [0, 0, 0, 0],
    spadesBroken: false,
    currentTrick: [],
    completedTricks: [],
    turn: nextSeat(state.dealer),
    handNumber: state.handNumber + 1,
    lastHandResult: null,
  };
}

/** Record a bid for the seat whose turn it is. Advances to play when all four are in. */
export function placeBid(state: GameState, seat: Seat, bid: Bid): GameState {
  if (state.phase !== "bidding") throw new Error("not bidding");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn to bid`);
  if (state.bids[seat]) throw new Error("already bid");

  const bids = state.bids.slice();
  bids[seat] = normalizeBid(bid);

  const allIn = bids.every((b) => b !== null);
  return {
    ...state,
    bids,
    phase: allIn ? "playing" : "bidding",
    // Play starts left of the dealer (the first bidder). Bidding done → same seat leads.
    turn: allIn ? nextSeat(state.dealer) : nextSeat(seat),
  };
}

function normalizeBid(bid: Bid): Bid {
  const tricks = Math.max(0, Math.min(13, Math.floor(bid.tricks)));
  return { tricks, blind: tricks === 0 ? bid.blind : false };
}

/** Play a card for the seat whose turn it is. Resolves the trick / hand as needed. */
export function playCard(state: GameState, seat: Seat, card: Card): GameState {
  if (state.phase !== "playing") throw new Error("not in play");
  if (state.turn !== seat) throw new Error(`not seat ${seat}'s turn`);

  const hand = state.hands[seat];
  if (!hand.some((c) => cardId(c) === cardId(card))) throw new Error("card not in hand");
  if (!isLegalPlay(card, hand, state.currentTrick, state.spadesBroken)) {
    throw new Error("illegal play");
  }

  const hands = state.hands.map((h, i) =>
    i === seat ? h.filter((c) => cardId(c) !== cardId(card)) : h);
  const spadesBroken = state.spadesBroken || playBreaksSpades(card, state.currentTrick);
  const currentTrick = [...state.currentTrick, { seat, card }];

  // Trick still in progress.
  if (currentTrick.length < 4) {
    return { ...state, hands, spadesBroken, currentTrick, turn: nextSeat(seat) };
  }

  // Trick complete → award, then either lead next trick or finish the hand.
  const winner = trickWinner(currentTrick);
  const tricksWon = state.tricksWon.slice();
  tricksWon[winner] += 1;
  const completedTricks = [...state.completedTricks, currentTrick];

  const handOver = completedTricks.length === 13;
  if (!handOver) {
    return {
      ...state, hands, spadesBroken, tricksWon, completedTricks,
      currentTrick: [], turn: winner,
    };
  }

  // Hand finished → score it.
  const { teamScores, result } = scoreHand(
    state.bids, tricksWon, state.teamScores, state.handNumber,
  );

  const reached = teamScores
    .map((t, i) => ({ i, s: t.score }))
    .filter((t) => t.s >= state.targetScore);
  // Winner = highest score at/over target; a tie at/over target keeps playing.
  let winnerTeam: 0 | 1 | null = null;
  if (reached.length === 1) winnerTeam = reached[0].i as 0 | 1;
  else if (reached.length === 2 && teamScores[0].score !== teamScores[1].score) {
    winnerTeam = (teamScores[0].score > teamScores[1].score ? 0 : 1);
  }

  return {
    ...state,
    hands, spadesBroken, tricksWon, completedTricks,
    currentTrick: [],
    teamScores,
    lastHandResult: result,
    phase: winnerTeam !== null ? "gameOver" : "handComplete",
    winner: winnerTeam,
    // Rotate dealer for the next hand.
    dealer: nextSeat(state.dealer),
  };
}

/** After a hand completes (and no winner), deal the next hand. */
export function dealNextHand(state: GameState, rng: () => number = Math.random): GameState {
  if (state.phase !== "handComplete") throw new Error("hand not complete");
  return startHand(state, rng);
}

// ── convenience selectors for the UI ────────────────────────────────────────

export function currentLeadSuit(state: GameState) {
  return leadSuit(state.currentTrick);
}

export function handSorted(state: GameState, seat: Seat): Card[] {
  return sortHand(state.hands[seat]);
}
