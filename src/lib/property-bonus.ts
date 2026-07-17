// Vegas property daily bonus — pure half. Pick one of six Vegas-style
// properties once per Vegas day; each pays from its own curve. Ranges are
// tuned so every property lands near the same ~850-950 expected value —
// the choice is about risk shape (safe/flat vs. wide/spiky), not a
// strictly-better option. IO (claim gating, crediting chips) lives in the
// API route, same split as promotions.ts/tableMinimum.ts.

import type { Rng } from "./blackjack/engine";

const defaultRng: Rng = () => Math.random();

export interface PropertyDef {
  id: string;
  name: string;
  tagline: string;
  /** Uniform base payout range. */
  base: readonly [number, number];
  /** Chance [0,1] of the bonus effect instead of/on top of the base roll. */
  bonusChance?: number;
  /** Fixed jackpot range paid instead of the base roll when the bonus hits. */
  bonusRange?: readonly [number, number];
  /** Multiplies the base roll when the bonus hits (e.g. an "encore" double). */
  bonusMultiplier?: number;
  bonusLabel?: string;
}

export const PROPERTY_CATALOG: readonly PropertyDef[] = [
  {
    id: "circus-circus",
    name: "Circus Circus",
    tagline: "Safe & steady — a reliable payout every time.",
    base: [750, 950],
  },
  {
    id: "mgm-grand",
    name: "MGM Grand",
    tagline: "Standard odds, a wide honest range.",
    base: [500, 1300],
  },
  {
    id: "bellagio",
    name: "Bellagio",
    tagline: "Balanced, with a rare Fountain Show jackpot.",
    base: [500, 1100],
    bonusChance: 0.05,
    bonusRange: [2000, 2000],
    bonusLabel: "🎆 Fountain Show!",
  },
  {
    id: "caesars-palace",
    name: "Caesars Palace",
    tagline: "Bold — the widest spread on the strip.",
    base: [100, 1700],
  },
  {
    id: "wynn",
    name: "Wynn",
    tagline: "Modest most nights, a rare Penthouse jackpot.",
    base: [300, 900],
    bonusChance: 0.05,
    bonusRange: [5000, 5000],
    bonusLabel: "🏆 Penthouse Jackpot!",
  },
  {
    id: "the-sphere",
    name: "The Sphere",
    tagline: "Wildcard — occasionally doubles up.",
    base: [250, 1450],
    bonusChance: 0.08,
    bonusMultiplier: 2,
    bonusLabel: "✨ Encore — doubled!",
  },
] as const;

export function findProperty(id: string): PropertyDef | undefined {
  return PROPERTY_CATALOG.find((p) => p.id === id);
}

/** Roll this property's payout. Returns the amount and whether the bonus hit. */
export function rollPropertyAmount(
  def: PropertyDef,
  rng: Rng = defaultRng
): { amount: number; bonusHit: boolean } {
  const [lo, hi] = def.base;
  const base = Math.floor(lo + rng() * (hi - lo));

  const bonusHit = (def.bonusChance ?? 0) > 0 && rng() < (def.bonusChance ?? 0);
  if (!bonusHit) return { amount: base, bonusHit: false };

  if (def.bonusRange) {
    const [blo, bhi] = def.bonusRange;
    return { amount: Math.floor(blo + rng() * (bhi - blo)), bonusHit: true };
  }
  if (def.bonusMultiplier) {
    return { amount: base * def.bonusMultiplier, bonusHit: true };
  }
  return { amount: base, bonusHit: false };
}
