// Tile model for basic Draw Dominoes — double-6 set, 28 tiles.

export interface Tile {
  a: number; // 0..6
  b: number; // 0..6
}

export function isDouble(t: Tile): boolean {
  return t.a === t.b;
}

export function pips(t: Tile): number {
  return t.a + t.b;
}

export function handPips(hand: Tile[]): number {
  return hand.reduce((sum, t) => sum + pips(t), 0);
}

export function tileId(t: Tile): string {
  return `${t.a}-${t.b}`;
}

/** The full double-6 set: every unique (a,b) with 0<=a<=b<=6 — 28 tiles. */
export function fullSet(): Tile[] {
  const tiles: Tile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) tiles.push({ a, b });
  }
  return tiles;
}

/** Fisher–Yates. Accepts an injectable rng for deterministic tests. */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ranking for the no-double opening-lead fallback: highest single number
 * first, then the other. 6-4 (64) beats 6-3 (63) beats 5-4 (54) — the
 * conventional "highest tile leads" rule among non-doubles.
 */
export function tileStrength(t: Tile): number {
  const hi = Math.max(t.a, t.b);
  const lo = Math.min(t.a, t.b);
  return hi * 10 + lo;
}
