import type { Card } from "./cards";
import { cardValue } from "./cards";

/** A meld is 3+ cards: a same-rank set, or a same-suit consecutive run. */
export type Meld = Card[];

export interface MeldSolution {
  melds: Meld[];
  deadwood: Card[];
  deadwoodValue: number;
}

/** Deadwood threshold under which a bot considers dropping. Humans may drop with any hand. */
export const DROP_THRESHOLD = 5;

function sumValue(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const item of arr) {
    const k = key(item);
    const bucket = m.get(k);
    if (bucket) bucket.push(item);
    else m.set(k, [item]);
  }
  return m;
}

/** Every valid set (3-4 same rank) and run (3+ same-suit consecutive) within `cards`. */
function candidateMelds(cards: Card[]): Meld[] {
  const melds: Meld[] = [];

  for (const group of groupBy(cards, (c) => c.rank).values()) {
    if (group.length < 3) continue;
    for (let k = 3; k <= group.length; k++) melds.push(...combinations(group, k));
  }

  for (const group of groupBy(cards, (c) => c.suit).values()) {
    const sorted = [...group].sort((a, b) => a.rank - b.rank);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].rank === sorted[j].rank + 1) j++;
      const runLen = j - i + 1;
      if (runLen >= 3) {
        for (let start = i; start <= j - 2; start++) {
          for (let end = start + 2; end <= j; end++) melds.push(sorted.slice(start, end + 1));
        }
      }
      i = j + 1;
    }
  }

  return melds;
}

/**
 * Optimal partition of `cards` into non-overlapping melds, minimizing leftover
 * deadwood value. Small brute-force search — hands here never exceed ~7 cards.
 */
function solve(cards: Card[]): { melds: Meld[]; deadwood: Card[] } {
  if (cards.length === 0) return { melds: [], deadwood: [] };

  const [first, ...rest] = cards;
  const skip = solve(rest);
  let best = { melds: skip.melds, deadwood: [first, ...skip.deadwood] };

  for (const meld of candidateMelds(cards)) {
    if (!meld.includes(first)) continue;
    const remaining = cards.filter((c) => !meld.includes(c));
    const sub = solve(remaining);
    const candidate = { melds: [meld, ...sub.melds], deadwood: sub.deadwood };
    if (sumValue(candidate.deadwood) < sumValue(best.deadwood)) best = candidate;
  }

  return best;
}

export function bestMelds(hand: Card[]): MeldSolution {
  const { melds, deadwood } = solve(hand);
  return { melds, deadwood, deadwoodValue: sumValue(deadwood) };
}

/** Tonk requires the entire hand to meld with zero deadwood left over. */
export function canTonk(hand: Card[]): boolean {
  return bestMelds(hand).deadwoodValue === 0;
}

export function describeMeld(meld: Meld): "Set" | "Run" {
  return meld[0].suit === meld[1].suit && meld[0].rank !== meld[1].rank ? "Run" : "Set";
}
