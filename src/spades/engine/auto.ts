// Server-side auto-play for Spades multiplayer (v0.48.0): the same bot AI
// heuristics in bots.ts serve two purposes with one code path —
//   1. seats 1 & 3 are always bots and never act any other way
//   2. a HUMAN seat (0 or 2) whose 30s turn clock expired gets the bot's own
//      recommended bid/play as their forced action, not some separate
//      arbitrary fallback (e.g. always-Nil or always-lowest-card)
// Both are just "apply the bot's recommendation for this seat" — autoAct
// below is that single function, and lib/spades-table.ts is the only
// caller, from two call sites (the bot cascade, and turn-deadline
// enforcement).

import { botBid, botPlay } from "./bots";
import { placeBid, playCard } from "./game";
import type { GameState, Seat } from "./types";

export const BOT_SEATS: readonly Seat[] = [1, 3];
export const HUMAN_SEATS: readonly Seat[] = [0, 2];

export function isBotSeat(seat: Seat): boolean {
  return BOT_SEATS.includes(seat);
}

/**
 * Apply the bot AI's own recommended action for `seat` — bidding or
 * playing, whichever phase the game is in. A no-op if it's no longer
 * `seat`'s turn (defensive: callers should already guard this, but a stale
 * state should never throw here).
 */
export function autoAct(state: GameState, seat: Seat): GameState {
  if (state.turn !== seat) return state;
  if (state.phase === "bidding") {
    return placeBid(state, seat, botBid(state.hands[seat], state.rules));
  }
  if (state.phase === "playing") {
    return playCard(state, seat, botPlay(state, seat));
  }
  return state;
}

/**
 * Resolve every consecutive bot turn immediately — there's no background
 * worker in this codebase (same no-cron convention as Invite/turn-clock
 * expiry), so whichever request causes it to become a bot's turn resolves
 * it synchronously before the response goes out. In practice this never
 * cascades more than one seat at a time (bots sit at 1 & 3, alternating
 * with humans at 0 & 2 in turn order), but the loop is written generally
 * with a generous safety valve rather than assuming that invariant holds
 * forever.
 */
export function resolveBotTurns(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while ((s.phase === "bidding" || s.phase === "playing") && isBotSeat(s.turn) && guard++ < 200) {
    s = autoAct(s, s.turn);
  }
  return s;
}
