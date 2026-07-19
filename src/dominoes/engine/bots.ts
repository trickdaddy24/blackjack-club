import { isDouble, pips, type Tile } from "./tiles";
import { legalMoves } from "./game";
import type { Board, End } from "./types";

// Simple heuristic, no LLM: when the bot has a choice of legal plays, it
// prefers shedding its heaviest tiles and doubles first — both are harder
// to place later (a double needs a matching end; a high-pip tile just costs
// more if the round blocks). No hand-reading or deliberate blocking.

const DOUBLE_BONUS = 3;

function playWeight(t: Tile): number {
  return pips(t) + (isDouble(t) ? DOUBLE_BONUS : 0);
}

/** The bot's chosen play, or null if it has nothing legal (must draw/pass). */
export function botChoosePlay(
  hand: Tile[],
  board: Board
): { index: number; end: End } | null {
  const moves = legalMoves(hand, board);
  if (moves.length === 0) return null;

  let best = moves[0];
  let bestWeight = playWeight(hand[best.index]);
  for (const m of moves.slice(1)) {
    const w = playWeight(hand[m.index]);
    if (w > bestWeight) {
      best = m;
      bestWeight = w;
    }
  }
  return best;
}
