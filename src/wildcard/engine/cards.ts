// Card model for a classic 108-card color-shedding deck ("crazy" family).
// Per color: one 0, two each of 1-9, two Skip, two Reverse, two Draw Two.
// Plus four Wilds and four Wild Draw Fours (colorless until played).

export type Color = "R" | "Y" | "G" | "B";
export type Kind =
  | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface Card {
  id: number;          // unique serial — the deck has duplicate color/kind pairs
  color: Color | null; // null for wilds
  kind: Kind;
}

export const COLORS: Color[] = ["R", "Y", "G", "B"];

export const COLOR_NAME: Record<Color, string> = {
  R: "Red", Y: "Yellow", G: "Green", B: "Blue",
};

export function isWild(c: Card): boolean {
  return c.kind === "wild" || c.kind === "wild4";
}

export function isNumber(c: Card): boolean {
  return typeof c.kind === "number";
}

/** Points the card is worth to the hand winner at scoring time. */
export function cardScore(c: Card): number {
  if (typeof c.kind === "number") return c.kind;
  if (c.kind === "wild" || c.kind === "wild4") return 50;
  return 20; // skip / reverse / draw2
}

export function kindLabel(k: Kind): string {
  if (typeof k === "number") return String(k);
  switch (k) {
    case "skip": return "⦸";
    case "reverse": return "⇄";
    case "draw2": return "+2";
    case "wild": return "W";
    case "wild4": return "+4";
  }
}

/** Build the full 108-card deck with unique serial ids. */
export function freshDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, kind: 0 });
    for (let n = 1; n <= 9; n++) {
      deck.push({ id: id++, color, kind: n as Kind });
      deck.push({ id: id++, color, kind: n as Kind });
    }
    for (const k of ["skip", "reverse", "draw2"] as Kind[]) {
      deck.push({ id: id++, color, kind: k });
      deck.push({ id: id++, color, kind: k });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: id++, color: null, kind: "wild" });
  for (let i = 0; i < 4; i++) deck.push({ id: id++, color: null, kind: "wild4" });
  return deck;
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
