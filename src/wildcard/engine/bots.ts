import type { Card, Color } from "./cards";
import { COLORS, isWild } from "./cards";
import { legalPlays } from "./rules";
import type { GameState, Seat } from "./game";
import { topCard } from "./game";

// Heuristic bot — no LLM. Durable shedding principles: dump expensive cards,
// keep wilds for when you're stuck, punish a low-card opponent with attack
// cards, and pick your deepest color on wilds.

const nextSeat = (s: Seat, dir: 1 | -1): Seat => ((((s + dir) % 4) + 4) % 4) as Seat;

/** Pick the color the bot holds the most of (wilds excluded). */
export function botChooseColor(hand: Card[]): Color {
  const counts: Record<Color, number> = { R: 0, Y: 0, G: 0, B: 0 };
  for (const c of hand) if (c.color) counts[c.color]++;
  let best: Color = COLORS[0];
  for (const c of COLORS) if (counts[c] > counts[best]) best = c;
  return best;
}

/**
 * Choose the card to play, or null to draw. Returns the card plus the color to
 * declare if it's a wild.
 */
export function botPlay(state: GameState, seat: Seat): { card: Card; chosenColor?: Color } | null {
  const hand = state.hands[seat];
  const legal = legalPlays(hand, topCard(state).kind, state.activeColor);
  if (legal.length === 0) return null;

  const victim = nextSeat(seat, state.direction);
  const victimLow = state.hands[victim].length <= 2;

  const attack = (c: Card) => c.kind === "draw2" || c.kind === "skip" || c.kind === "reverse";
  const rank = (c: Card): number => {
    // Higher = play sooner.
    if (victimLow && c.kind === "wild4") return 100;
    if (victimLow && c.kind === "draw2") return 90;
    if (victimLow && attack(c)) return 80;
    if (typeof c.kind === "number") return 40 + c.kind; // dump high numbers first
    if (attack(c)) return 30;      // action cards mid-priority when no one is low
    if (c.kind === "wild") return 10;  // hold wilds
    return 5;                      // wild4 held longest (also: honor-ish rule)
  };

  let best = legal[0];
  for (const c of legal) if (rank(c) > rank(best)) best = c;

  return isWild(best)
    ? { card: best, chosenColor: botChooseColor(hand.filter((c) => c.id !== best.id)) }
    : { card: best };
}
