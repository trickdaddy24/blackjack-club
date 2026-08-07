// Per-seat redacted view of a Spades GameState (multiplayer, v0.48.0). NEW —
// nothing like this exists anywhere else in the codebase: Blackjack's
// clientView() (src/lib/blackjack/engine.ts) returns ONE shared view for
// both players, only hiding the dealer's hole card. Spades needs a
// genuinely per-viewer view, because unlike a single shared dealer hand,
// EVERY other seat holds private information.
//
// Real Spades information rules: a hand is the only secret. Bids, the
// current trick's played cards, completed-trick counts, and team scores are
// public the instant they happen. So this function reveals:
//   - the viewer's own hand: real Card[]
//   - every OTHER seat's hand: a card COUNT only, never the actual cards
//   - everything else (bids, tricksWon, currentTrick, teamScores, ...): as-is
//
// This is the only function allowed to turn a server-side GameState into
// something sent to a browser for the multiplayer table — same rule
// blackjack's engine.ts documents for its own clientView().

import { sortHand } from "./cards";
import type { GameState, Seat } from "./types";
import type { Bid, HandResult, PlayedCard, TeamScore } from "./types";
import type { Card, SpadesRules } from "./cards";

export interface SeatHandView {
  seat: Seat;
  /** The viewer's own cards, sorted for display. Null for every other seat —
   *  MUST stay null; that's the entire point of this module. */
  cards: Card[] | null;
  /** Always accurate, for every seat including the viewer's own. */
  cardCount: number;
}

export interface SpadesClientView {
  phase: GameState["phase"];
  viewerSeat: Seat;
  rules: SpadesRules;
  dealer: Seat;
  turn: Seat;
  spadesBroken: boolean;
  /** Index-aligned with Seat (0..3). Redaction happens per-entry — see SeatHandView. */
  hands: SeatHandView[];
  bids: (Bid | null)[];
  tricksWon: number[];
  currentTrick: PlayedCard[];
  completedTrickCount: number;
  teamScores: [TeamScore, TeamScore];
  targetScore: number;
  handNumber: number;
  lastHandResult: HandResult | null;
  winner: 0 | 1 | null;
}

/**
 * Redact `state` for `viewerSeat`. `viewerSeat` must come from server-side
 * seat lookup (whoever the authenticated user actually occupies) — never
 * from client input, or a malicious request could ask to view someone
 * else's hand.
 */
export function spadesClientView(state: GameState, viewerSeat: Seat): SpadesClientView {
  const hands: SeatHandView[] = state.hands.map((hand, i) => {
    const seat = i as Seat;
    const isViewer = seat === viewerSeat;
    return {
      seat,
      cards: isViewer ? sortHand(hand, state.rules) : null,
      cardCount: hand.length,
    };
  });

  return {
    phase: state.phase,
    viewerSeat,
    rules: state.rules,
    dealer: state.dealer,
    turn: state.turn,
    spadesBroken: state.spadesBroken,
    hands,
    bids: state.bids,
    tricksWon: state.tricksWon,
    currentTrick: state.currentTrick,
    completedTrickCount: state.completedTricks.length,
    teamScores: state.teamScores,
    targetScore: state.targetScore,
    handNumber: state.handNumber,
    lastHandResult: state.lastHandResult,
    winner: state.winner,
  };
}
