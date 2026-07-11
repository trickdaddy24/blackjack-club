import type { BetSpot, PocketId, WheelKind } from "./types";
import { PAYOUT } from "./bets";
import { isRed } from "./wheel";

// The number region is the standard 3 rows x 12 columns grid:
//   row 0 (top):    3  6  9 ... 36
//   row 1 (mid):    2  5  8 ... 35
//   row 2 (bottom): 1  4  7 ... 34
export const COLS = 12;
export const ROWS = 3;

/** Number printed at grid cell (row r 0..2 top->bottom, col c 0..11). */
export function numAt(r: number, c: number): number {
  return 3 * c + (3 - r);
}

const id = (n: number): PocketId => String(n);
const allNumbers = Array.from({ length: 36 }, (_, i) => i + 1);

// Overlay coordinates (0..1) within the number region.
const xCenter = (c: number) => (c + 0.5) / COLS;
const yCenter = (r: number) => (r + 0.5) / ROWS;
const xLine = (c: number) => c / COLS;   // vertical grid line left of column c
const yLine = (r: number) => r / ROWS;   // horizontal grid line above row r

/**
 * Build every placeable bet spot for a wheel kind. Returned once and reused;
 * combo spots (split/street/corner/sixline/basket) carry x/y for the overlay,
 * everything else is positioned by the UI from its key.
 */
export function buildBetSpots(kind: WheelKind): BetSpot[] {
  const spots: BetSpot[] = [];
  const push = (s: BetSpot) => spots.push(s);

  // ── Straight up: 0, (00), 1..36 ────────────────────────────────────────────
  push({ key: "straight-0", kind: "straight", numbers: ["0"], payout: PAYOUT.straight });
  if (kind === "american") {
    push({ key: "straight-00", kind: "straight", numbers: ["00"], payout: PAYOUT.straight });
  }
  for (const n of allNumbers) {
    push({ key: `straight-${n}`, kind: "straight", numbers: [id(n)], payout: PAYOUT.straight });
  }

  // ── Splits (two adjacent numbers) ──────────────────────────────────────────
  // Horizontal: (r,c)-(r,c+1)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const a = numAt(r, c), b = numAt(r, c + 1);
      push({
        key: `split-${Math.min(a, b)}-${Math.max(a, b)}`, kind: "split",
        numbers: [id(a), id(b)], payout: PAYOUT.split, x: xLine(c + 1), y: yCenter(r),
      });
    }
  }
  // Vertical: (r,c)-(r+1,c)
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const a = numAt(r, c), b = numAt(r + 1, c);
      push({
        key: `split-${Math.min(a, b)}-${Math.max(a, b)}`, kind: "split",
        numbers: [id(a), id(b)], payout: PAYOUT.split, x: xCenter(c), y: yLine(r + 1),
      });
    }
  }

  // ── Streets (three numbers in a column) ────────────────────────────────────
  for (let c = 0; c < COLS; c++) {
    const nums = [numAt(2, c), numAt(1, c), numAt(0, c)]; // 3c+1,3c+2,3c+3
    push({
      key: `street-${numAt(2, c)}`, kind: "street",
      numbers: nums.map(id), payout: PAYOUT.street, x: xCenter(c), y: 1,
    });
  }

  // ── Corners (four numbers) ─────────────────────────────────────────────────
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const nums = [numAt(r, c), numAt(r + 1, c), numAt(r, c + 1), numAt(r + 1, c + 1)];
      push({
        key: `corner-${Math.min(...nums)}`, kind: "corner",
        numbers: nums.map(id), payout: PAYOUT.corner, x: xLine(c + 1), y: yLine(r + 1),
      });
    }
  }

  // ── Six lines (two adjacent streets) ───────────────────────────────────────
  for (let c = 0; c < COLS - 1; c++) {
    const nums = [
      numAt(2, c), numAt(1, c), numAt(0, c),
      numAt(2, c + 1), numAt(1, c + 1), numAt(0, c + 1),
    ];
    push({
      key: `sixline-${Math.min(...nums)}`, kind: "sixline",
      numbers: nums.map(id), payout: PAYOUT.sixline, x: xLine(c + 1), y: 1,
    });
  }

  // ── Zero-row combos ────────────────────────────────────────────────────────
  if (kind === "european") {
    // Zero splits 0-1, 0-2, 0-3 at the left edge.
    for (const n of [3, 2, 1]) {
      const r = 3 - n; // 1->row2, 2->row1, 3->row0
      push({
        key: `split-0-${n}`, kind: "split", numbers: ["0", id(n)],
        payout: PAYOUT.split, x: 0, y: yCenter(r),
      });
    }
    // "First four" 0-1-2-3 (8:1), placed at the top-left corner of the grid.
    push({
      key: "basket", kind: "basket", numbers: ["0", "1", "2", "3"],
      payout: 8, label: "0-1-2-3", x: 0, y: 0,
    });
  } else {
    // American 0-00 split and the five-number basket 0-00-1-2-3 (6:1).
    push({
      key: "split-0-00", kind: "split", numbers: ["0", "00"],
      payout: PAYOUT.split, x: 0, y: 0.5,
    });
    push({
      key: "basket", kind: "basket", numbers: ["0", "00", "1", "2", "3"],
      payout: PAYOUT.basket, label: "0-00-1-2-3", x: 0, y: 1,
    });
  }

  // ── Outside bets (no overlay coords; UI lays these out) ─────────────────────
  // Dozens
  push({ key: "dozen-1", kind: "dozen", numbers: allNumbers.slice(0, 12).map(id), payout: PAYOUT.dozen, label: "1st 12" });
  push({ key: "dozen-2", kind: "dozen", numbers: allNumbers.slice(12, 24).map(id), payout: PAYOUT.dozen, label: "2nd 12" });
  push({ key: "dozen-3", kind: "dozen", numbers: allNumbers.slice(24, 36).map(id), payout: PAYOUT.dozen, label: "3rd 12" });

  // Columns (2:1) — one per grid row.
  push({ key: "column-top", kind: "column", numbers: colNumbers(0), payout: PAYOUT.column, label: "2:1" });
  push({ key: "column-mid", kind: "column", numbers: colNumbers(1), payout: PAYOUT.column, label: "2:1" });
  push({ key: "column-bottom", kind: "column", numbers: colNumbers(2), payout: PAYOUT.column, label: "2:1" });

  // Even-money
  push({ key: "low", kind: "low", numbers: allNumbers.slice(0, 18).map(id), payout: PAYOUT.low, label: "1-18" });
  push({ key: "even", kind: "even", numbers: allNumbers.filter((n) => n % 2 === 0).map(id), payout: PAYOUT.even, label: "EVEN" });
  push({ key: "red", kind: "red", numbers: allNumbers.filter((n) => isRed(id(n))).map(id), payout: PAYOUT.red, label: "RED" });
  push({ key: "black", kind: "black", numbers: allNumbers.filter((n) => !isRed(id(n))).map(id), payout: PAYOUT.black, label: "BLACK" });
  push({ key: "odd", kind: "odd", numbers: allNumbers.filter((n) => n % 2 === 1).map(id), payout: PAYOUT.odd, label: "ODD" });
  push({ key: "high", kind: "high", numbers: allNumbers.slice(18, 36).map(id), payout: PAYOUT.high, label: "19-36" });

  return spots;
}

/** The 12 numbers in grid row r (0=top 3..36, 1=mid 2..35, 2=bottom 1..34). */
function colNumbers(r: number): PocketId[] {
  return Array.from({ length: COLS }, (_, c) => id(numAt(r, c)));
}

/** Fast lookup: spot key -> BetSpot. */
export function spotMap(kind: WheelKind): Map<string, BetSpot> {
  return new Map(buildBetSpots(kind).map((s) => [s.key, s]));
}
