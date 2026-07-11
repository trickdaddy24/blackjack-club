// Core roulette types. A pocket id is a string so "00" is representable
// alongside "0" and "1".."36".

export type WheelKind = "european" | "american";
export type PocketColor = "red" | "black" | "green";
export type PocketId = string; // "0" | "00" | "1" ... "36"

/** The kind of wager. Payout (X:1) is a property of the kind. */
export type BetKind =
  | "straight"     // 1 number   — 35:1
  | "split"        // 2 numbers  — 17:1
  | "street"       // 3 numbers  — 11:1
  | "corner"       // 4 numbers  —  8:1
  | "basket"       // 0-00-1-2-3 —  6:1 (American) / 0-1-2-3 8:1 (European "first four")
  | "sixline"      // 6 numbers  —  5:1
  | "column"       // 12 numbers —  2:1
  | "dozen"        // 12 numbers —  2:1
  | "red" | "black"      // 1:1
  | "even" | "odd"       // 1:1
  | "low" | "high";      // 1:1

/** A placeable spot on the felt: a stable key, what it covers, and its payout.
 *  Combo hotspots (split/street/corner/sixline/basket) carry x/y (0..1)
 *  coordinates for an overlay positioned over the 3x12 number region; straight
 *  and outside bets are laid out by the UI from their key/kind. */
export interface BetSpot {
  key: string;          // unique, stable id for stacking chips
  kind: BetKind;
  numbers: PocketId[];  // pockets this spot wins on
  payout: number;       // winnings per unit staked (35 = 35:1)
  label?: string;       // for outside bets / display
  x?: number;           // 0..1 horizontal position within the number region
  y?: number;           // 0..1 vertical position within the number region
}

/** A chip stack the player has placed on a spot. */
export interface PlacedBet {
  spotKey: string;
  kind: BetKind;
  numbers: PocketId[];
  payout: number;
  amount: number;       // total wagered on this spot
}

/** Outcome of one spin, after settling all placed bets. */
export interface SpinResult {
  pocket: PocketId;
  color: PocketColor;
  totalStaked: number;  // sum of bets placed
  totalReturn: number;  // stake back + winnings on winning bets
  net: number;          // totalReturn - totalStaked
  winningKeys: string[]; // spot keys that hit
}

export interface GameState {
  wheel: WheelKind;
  balance: number;
  chip: number;                 // currently selected chip denomination
  bets: Record<string, PlacedBet>; // keyed by spotKey
  placements: { spotKey: string; amount: number }[]; // chronological, for undo
  lastBets: PlacedBet[];        // snapshot of the last settled round, for "rebet"
  history: PocketId[];          // recent results, newest first
  lastResult: SpinResult | null;
  spinning: boolean;
}
