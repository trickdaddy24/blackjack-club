import type { Tile } from "./tiles";

// Heads-up only: seat 0 is always the human, seat 1 the bot.
export type Seat = 0 | 1;
export type Phase = "playing" | "roundOver";
export type End = "left" | "right";

export interface PlacedTile {
  tile: Tile;
  seat: Seat; // who placed it, for attribution in the UI
}

export interface Board {
  line: PlacedTile[]; // placement order, left to right
  leftEnd: number | null; // open value at the left end; null before the opener
  rightEnd: number | null; // open value at the right end
}

/** Why the round ended, for the result panel. */
export type RoundOutcome =
  | { kind: "emptied"; winner: Seat }
  | { kind: "block"; winner: Seat | "tie" };

export interface GameState {
  phase: Phase;
  hands: [Tile[], Tile[]];
  boneyard: Tile[];
  board: Board;
  turn: Seat;
  /** Consecutive passes (empty boneyard, no legal play) — 2 in a row blocks the round. */
  passStreak: number;
  outcome: RoundOutcome | null;
}
