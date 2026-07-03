// Client-side "house" for the static build — same response shapes as the
// server API, but chips and round state live in localStorage. Play-money
// only, so a devtools cheater is only cheating themselves.

import {
  applyAction,
  clientView,
  MAX_SEATS,
  netResult,
  startRound,
  type ClientView,
  type PlayerAction,
  type RoundState,
} from "../../src/lib/blackjack/engine";

export const MIN_BET = 5;
export const MAX_BET = 1_000_000;
export const STARTING_CHIPS = 10000;
export const DAILY_BONUS = 2500;
export const RESCUE_CHIPS = 1000;

const K = {
  chips: "bj-chips",
  bonus: "bj-last-bonus",
  round: "bj-round",
} as const;

function readChips(): number {
  const raw = localStorage.getItem(K.chips);
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : STARTING_CHIPS;
}

function writeChips(n: number) {
  localStorage.setItem(K.chips, String(n));
}

/** Last round state — kept after settling too, for shoe continuity. */
function readRound(): RoundState | null {
  const raw = localStorage.getItem(K.round);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoundState;
  } catch {
    return null;
  }
}

function writeRound(state: RoundState) {
  localStorage.setItem(K.round, JSON.stringify(state));
}

function bonusAvailable(): boolean {
  const last = Number(localStorage.getItem(K.bonus) ?? 0);
  return Date.now() - last >= 24 * 60 * 60 * 1000;
}

export interface GameResponse {
  chips: number;
  round: ClientView;
}

export function getState(): {
  chips: number;
  bonusAvailable: boolean;
  round: ClientView | null;
} {
  const last = readRound();
  const active = last && last.phase !== "settled" ? last : null;
  return {
    chips: readChips(),
    bonusAvailable: bonusAvailable(),
    round: active ? clientView(active) : null,
  };
}

export function bet(amount: number, seats: number): GameResponse {
  if (!Number.isInteger(amount) || amount < MIN_BET || amount > MAX_BET) {
    throw new Error(`Bet must be a whole number between ${MIN_BET} and ${MAX_BET}`);
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw new Error(`You can play 1 to ${MAX_SEATS} hands`);
  }
  const last = readRound();
  if (last && last.phase !== "settled") {
    throw new Error("You already have a round in progress");
  }
  const chips = readChips();
  if (chips < amount * seats) throw new Error("Not enough chips");

  const { state, debit } = startRound(amount, last?.shoe ?? null, undefined, seats);
  const settled = state.phase === "settled";
  const next = chips - debit + (settled ? state.payoutTotal : 0);
  writeChips(next);
  writeRound(state);
  return { chips: next, round: clientView(state) };
}

export function act(action: PlayerAction): GameResponse {
  const current = readRound();
  if (!current || current.phase === "settled") {
    throw new Error("No round in progress");
  }
  const chips = readChips();
  const { state, debit } = applyAction(current, action);
  if (debit > 0 && chips < debit) throw new Error("Not enough chips");

  const settled = state.phase === "settled";
  const next = chips - debit + (settled ? state.payoutTotal : 0);
  writeChips(next);
  writeRound(state);
  void netResult; // settled net is already inside clientView
  return { chips: next, round: clientView(state) };
}

export function claimBonus(): { chips: number; granted: number; type: string } {
  const chips = readChips();

  if (bonusAvailable()) {
    const next = chips + DAILY_BONUS;
    writeChips(next);
    localStorage.setItem(K.bonus, String(Date.now()));
    return { chips: next, granted: DAILY_BONUS, type: "daily" };
  }

  const last = readRound();
  const activeRound = last && last.phase !== "settled";
  if (chips < MIN_BET && !activeRound) {
    writeChips(RESCUE_CHIPS);
    return { chips: RESCUE_CHIPS, granted: RESCUE_CHIPS - chips, type: "rescue" };
  }

  throw new Error("Daily bonus not available yet");
}
