import type { Card, SpadesRules } from "./cards";

// Seats 0..3 sit clockwise. Partnerships are seats {0,2} (South+North) and
// {1,3} (West+East). The human is always seat 0 (South).
export type Seat = 0 | 1 | 2 | 3;
export type TeamId = 0 | 1; // team 0 = seats 0&2, team 1 = seats 1&3

export function teamOf(seat: Seat): TeamId {
  return (seat % 2) as TeamId;
}

export type Phase = "bidding" | "playing" | "handComplete" | "gameOver";

/** A bid of 0 = Nil. `blind` is a Nil declared before looking at the hand. */
export interface Bid {
  tricks: number; // 0..13; 0 means Nil
  blind: boolean; // blind nil (only meaningful when tricks === 0)
}

export interface PlayedCard {
  seat: Seat;
  card: Card;
}

export interface TeamScore {
  score: number; // cumulative game score
  bags: number;  // running bag count, resets by 10
}

export interface GameState {
  phase: Phase;
  rules: SpadesRules;       // active house-rule variants (e.g. deuces high)
  hands: Card[][];          // per seat, cards still held
  bids: (Bid | null)[];     // per seat
  tricksWon: number[];      // per seat, this hand
  dealer: Seat;
  turn: Seat;               // whose action it is (bid or play)
  spadesBroken: boolean;
  currentTrick: PlayedCard[];
  completedTricks: PlayedCard[][];
  teamScores: [TeamScore, TeamScore];
  targetScore: number;      // first team to reach it wins (default 500)
  handNumber: number;
  // Set when a hand finishes so the UI can show the breakdown before dealing on.
  lastHandResult: HandResult | null;
  winner: TeamId | null;
}

export interface TeamHandResult {
  bidTotal: number;         // combined contract (Nil counted as 0)
  tricks: number;           // combined tricks the team took
  points: number;           // net points this hand (incl. nil, bags)
  bagsGained: number;
  bagPenalty: number;       // -100 applied if bags rolled past 10 (0 or -100)
  nilResults: { seat: Seat; bid: Bid; made: boolean; points: number }[];
}

export interface HandResult {
  handNumber: number;
  teams: [TeamHandResult, TeamHandResult];
}
