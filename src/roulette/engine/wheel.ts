import type { PocketColor, PocketId, WheelKind } from "./types";

// Physical pocket order around each wheel, clockwise from the single 0.
// These are the real casino sequences (not numeric order).
export const EUROPEAN_ORDER: PocketId[] = [
  "0", "32", "15", "19", "4", "21", "2", "25", "17", "34", "6", "27", "13",
  "36", "11", "30", "8", "23", "10", "5", "24", "16", "33", "1", "20", "14",
  "31", "9", "22", "18", "29", "7", "28", "12", "35", "3", "26",
];

export const AMERICAN_ORDER: PocketId[] = [
  "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34",
  "15", "3", "24", "36", "13", "1", "00", "27", "10", "25", "29", "12", "8",
  "19", "31", "18", "6", "21", "33", "16", "4", "23", "35", "14", "2",
];

// The red numbers on any roulette wheel (the rest of 1..36 are black).
const RED = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function pocketColor(id: PocketId): PocketColor {
  if (id === "0" || id === "00") return "green";
  return RED.has(Number(id)) ? "red" : "black";
}

export function isRed(id: PocketId): boolean {
  return pocketColor(id) === "red";
}

export function wheelOrder(kind: WheelKind): PocketId[] {
  return kind === "american" ? AMERICAN_ORDER : EUROPEAN_ORDER;
}

/** Total pockets: 37 (European) or 38 (American). */
export function pocketCount(kind: WheelKind): number {
  return wheelOrder(kind).length;
}

/** Spin: pick a uniformly random pocket. `rng` is injectable for tests. */
export function spin(kind: WheelKind, rng: () => number = Math.random): PocketId {
  const order = wheelOrder(kind);
  return order[Math.floor(rng() * order.length)];
}

/** Index of a pocket in the wheel order (for landing the ball animation). */
export function pocketIndex(kind: WheelKind, id: PocketId): number {
  return wheelOrder(kind).indexOf(id);
}
