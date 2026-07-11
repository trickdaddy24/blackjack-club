import { settle } from "./bets";
import { pocketColor, spin } from "./wheel";
import type { BetSpot, GameState, PlacedBet, PocketId, SpinResult, WheelKind } from "./types";

export const CHIP_DENOMS = [1, 5, 25, 100, 500];
export const START_BALANCE = 1000;
const MAX_HISTORY = 24;

export function newGame(wheel: WheelKind = "european", balance = START_BALANCE): GameState {
  return {
    wheel,
    balance,
    chip: 5,
    bets: {},
    placements: [],
    lastBets: [],
    history: [],
    lastResult: null,
    spinning: false,
  };
}

/** Total currently wagered across all open bets. */
export function totalStaked(state: GameState): number {
  return Object.values(state.bets).reduce((s, b) => s + b.amount, 0);
}

export function setChip(state: GameState, chip: number): GameState {
  return { ...state, chip };
}

/**
 * Switch wheels. Pocket sets differ, so open bets are refunded and the board
 * resets; balance carries over.
 */
export function switchWheel(state: GameState, wheel: WheelKind): GameState {
  if (wheel === state.wheel) return state;
  const refunded = state.balance + totalStaked(state);
  return { ...newGame(wheel, refunded), chip: state.chip, history: state.history };
}

/** Place `amount` (defaults to the selected chip) on a spot. Debits balance. */
export function placeBet(state: GameState, spot: BetSpot, amount = state.chip): GameState {
  if (state.spinning) return state;
  if (amount <= 0 || amount > state.balance) return state; // insufficient funds
  const existing = state.bets[spot.key];
  const placed: PlacedBet = existing
    ? { ...existing, amount: existing.amount + amount }
    : {
      spotKey: spot.key, kind: spot.kind, numbers: spot.numbers,
      payout: spot.payout, amount,
    };
  return {
    ...state,
    balance: state.balance - amount,
    bets: { ...state.bets, [spot.key]: placed },
    placements: [...state.placements, { spotKey: spot.key, amount }],
  };
}

/** Undo the most recent chip placement, refunding it. */
export function undo(state: GameState): GameState {
  if (state.spinning || state.placements.length === 0) return state;
  const placements = state.placements.slice();
  const last = placements.pop()!;
  const bets = { ...state.bets };
  const bet = bets[last.spotKey];
  if (!bet) return state;
  if (bet.amount <= last.amount) delete bets[last.spotKey];
  else bets[last.spotKey] = { ...bet, amount: bet.amount - last.amount };
  return { ...state, balance: state.balance + last.amount, bets, placements };
}

/** Clear all open bets, refunding the full stake. */
export function clearBets(state: GameState): GameState {
  if (state.spinning) return state;
  return {
    ...state,
    balance: state.balance + totalStaked(state),
    bets: {},
    placements: [],
  };
}

/** Re-place the exact bets from the last settled round, if affordable. */
export function rebet(state: GameState): GameState {
  if (state.spinning || state.lastBets.length === 0 || Object.keys(state.bets).length > 0) {
    return state;
  }
  const cost = state.lastBets.reduce((s, b) => s + b.amount, 0);
  if (cost > state.balance) return state;
  const bets: Record<string, PlacedBet> = {};
  const placements: { spotKey: string; amount: number }[] = [];
  for (const b of state.lastBets) {
    bets[b.spotKey] = { ...b };
    placements.push({ spotKey: b.spotKey, amount: b.amount });
  }
  return { ...state, balance: state.balance - cost, bets, placements };
}

/**
 * Settle all open bets against an already-chosen pocket. Balance was debited
 * when bets were placed, so we credit back the winning returns (stake +
 * winnings). Snapshots the round for "rebet" and clears the board. The UI uses
 * this after the wheel animation lands on `pocket`.
 */
export function resolveSpin(state: GameState, pocket: PocketId): GameState {
  const placed = Object.values(state.bets);
  if (placed.length === 0) return state;

  const { totalStaked: staked, totalReturn, net, winningKeys } = settle(placed, pocket);

  const result: SpinResult = {
    pocket,
    color: pocketColor(pocket),
    totalStaked: staked,
    totalReturn,
    net,
    winningKeys,
  };

  return {
    ...state,
    balance: state.balance + totalReturn,
    lastResult: result,
    lastBets: placed.map((b) => ({ ...b })),
    bets: {},
    placements: [],
    history: [pocket, ...state.history].slice(0, MAX_HISTORY),
    spinning: false,
  };
}

/** Convenience: choose a pocket and settle in one step (used by tests). */
export function spinAndSettle(state: GameState, rng: () => number = Math.random): GameState {
  if (Object.keys(state.bets).length === 0) return state;
  return resolveSpin(state, spin(state.wheel, rng));
}
