// Counting Gym — pure pieces. Levels, truth math. Drills sample a freshly
// shuffled 6-deck shoe (same as the tables), so counts vary at every level
// and the reps transfer to real play.

import { hiLo, type Card } from "./blackjack/engine";

export interface GymLevel {
  id: string;
  name: string;
  emoji: string;
  cards: number;
  speedMs: number;
}

export const GYM_LEVELS: GymLevel[] = [
  { id: "rookie", name: "Rookie", emoji: "🐣", cards: 12, speedMs: 1400 },
  { id: "regular", name: "Regular", emoji: "🃏", cards: 20, speedMs: 1000 },
  { id: "sharp", name: "Sharp", emoji: "🔪", cards: 30, speedMs: 700 },
  { id: "pro", name: "Pro", emoji: "🎯", cards: 40, speedMs: 500 },
  { id: "wizard", name: "Wizard", emoji: "🧙", cards: 52, speedMs: 350 },
];

export const gymLevel = (id: string) => GYM_LEVELS.find((l) => l.id === id);

/** Levels that count as "elite" for the Eagle Eyes trophy. */
export const ELITE_LEVELS = new Set(["pro", "wizard"]);

/** The truth: Hi-Lo running count over the flashed cards. */
export function drillAnswer(cards: Card[]): number {
  return cards.reduce((n, c) => n + hiLo(c), 0);
}
