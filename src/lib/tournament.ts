// Sit-and-go tournaments — the pure half. An independent-stack leaderboard:
// each entrant plays HANDS_PER_ENTRANT solo hands against the dealer with an
// isolated stack, self-paced. IO (Prisma reads/writes, the lazy idle-cancel
// and deadline sweeps) lives in tournament-io.ts so vitest loads this
// without Prisma — same split as hotseat.ts / hotseat-io.ts.

export const TOURNAMENT_BUY_IN = 1000;
export const HANDS_PER_ENTRANT = 20;
export const MIN_ENTRANTS = 3;
export const MAX_ENTRANTS = 8;

// 24h from start: anyone still mid-run is forfeited in place (ranked by
// whatever stack they'd reached), not treated as an error/crash state.
export const COMPLETION_DEADLINE_MS = 24 * 60 * 60 * 1000;
// No new joins for an hour while still short of the minimum ⇒ auto-cancel,
// full refund to everyone who'd joined.
export const IDLE_CANCEL_MS = 60 * 60 * 1000;

export const FIRST_PLACE_PCT = 0.6;
export const SECOND_PLACE_PCT = 0.4;

// Betting bounds for tournament hands, scoped to the isolated stack rather
// than the player's main chips. Deliberately duplicated from lib/game.ts's
// MIN_BET/MAX_BET (same values) rather than imported — lib/game.ts pulls in
// Prisma at module scope, and this file needs to stay Prisma-free for
// vitest, matching the hotseat.ts/hotseat-io.ts convention.
export const TOURNAMENT_MIN_BET = 5;
export const TOURNAMENT_MAX_BET = 1_000_000;

export type LobbyStatus = "open" | "active" | "settled" | "canceled";
export type EntryStatus =
  | "joined"
  | "playing"
  | "finished"
  | "forfeited"
  | "backed-out"
  | "refunded";

export const TERMINAL_ENTRY_STATUSES: EntryStatus[] = [
  "finished",
  "forfeited",
  "backed-out",
  "refunded",
];

/** An entry is still in the running (occupies a seat, hasn't exited). */
export function isLiveEntryStatus(status: EntryStatus): boolean {
  return status === "joined" || status === "playing";
}

/** Lobby will accept one more entrant right now. */
export function canJoinLobby(status: LobbyStatus, entrantCount: number): boolean {
  return status === "open" && entrantCount < MAX_ENTRANTS;
}

/** Hitting the max seats fires the sit-and-go's auto-start. */
export function shouldAutoStart(entrantCount: number): boolean {
  return entrantCount >= MAX_ENTRANTS;
}

/** The creator can manually start once the floor is met. */
export function canManualStart(entrantCount: number): boolean {
  return entrantCount >= MIN_ENTRANTS;
}

/** Backing out only refunds cleanly before the tournament has started. */
export function canBackOut(lobbyStatus: LobbyStatus): boolean {
  return lobbyStatus === "open";
}

/** No new joins for IDLE_CANCEL_MS while still open ⇒ sweep-and-refund. */
export function isLobbyIdleExpired(lastJoinAt: Date, now: Date): boolean {
  return now.getTime() - lastJoinAt.getTime() >= IDLE_CANCEL_MS;
}

export function tournamentDeadline(startedAt: Date): Date {
  return new Date(startedAt.getTime() + COMPLETION_DEADLINE_MS);
}

export function isPastDeadline(deadlineAt: Date | null, now: Date): boolean {
  return deadlineAt !== null && now.getTime() >= deadlineAt.getTime();
}

export function isEntryComplete(handsPlayed: number): boolean {
  return handsPlayed >= HANDS_PER_ENTRANT;
}

/** Busted below the minimum bet with hands left ⇒ can't play on. */
export function canStillPlay(stack: number, handsPlayed: number): boolean {
  return !isEntryComplete(handsPlayed) && stack >= TOURNAMENT_MIN_BET;
}

export type BetCheck = { ok: true; bet: number } | { ok: false; error: string };

/** Validate a tournament hand's wager against the isolated stack. */
export function checkTournamentBet(bet: unknown, stack: number): BetCheck {
  if (typeof bet !== "number" || !Number.isInteger(bet)) {
    return { ok: false, error: "Bet must be a whole number" };
  }
  if (bet < TOURNAMENT_MIN_BET) {
    return { ok: false, error: `Minimum bet is ${TOURNAMENT_MIN_BET}` };
  }
  if (bet > TOURNAMENT_MAX_BET) {
    return { ok: false, error: `Maximum bet is ${TOURNAMENT_MAX_BET}` };
  }
  if (bet > stack) {
    return { ok: false, error: "Bet exceeds your tournament stack" };
  }
  return { ok: true, bet };
}

/** Side bets are off during tournament hands — keeps final-stack comparisons clean. */
export function rejectSideBets(input: {
  perfectPairs?: unknown;
  twentyOnePlusThree?: unknown;
  luckyLadies?: unknown;
}): string | null {
  const pp = typeof input.perfectPairs === "number" ? input.perfectPairs : 0;
  const tp = typeof input.twentyOnePlusThree === "number" ? input.twentyOnePlusThree : 0;
  const ll = typeof input.luckyLadies === "number" ? input.luckyLadies : 0;
  if (pp > 0 || tp > 0 || ll > 0) {
    return "Side bets are disabled in tournament hands";
  }
  return null;
}

/**
 * Divide `amount` integer chips across `ids` as evenly as possible. The
 * remainder (amount % ids.length) can't be split further — it's handed out
 * one chip at a time in a fixed, deterministic order (ids sorted ascending)
 * so payout math is reproducible and never leaks or invents a chip.
 */
export function splitEvenly(amount: number, ids: string[]): Map<string, number> {
  const out = new Map<string, number>();
  const n = ids.length;
  if (n === 0) return out;
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  const sorted = [...ids].sort();
  sorted.forEach((id, i) => out.set(id, base + (i < remainder ? 1 : 0)));
  return out;
}

export interface RankableEntry {
  id: string;
  finalStack: number;
}

export interface RankedEntry extends RankableEntry {
  rank: number;
  prize: number;
}

/**
 * Rank entrants by final stack (highest first) and split the prize pool
 * 60/40 between 1st and 2nd place. Ties share the combined percentage of
 * every place position their group spans, split evenly (see splitEvenly) —
 * e.g. a 2-way tie for 1st consumes both the 60% and 40% slots and splits
 * the full pool 50/50; a 2-way tie for 2nd splits just the 40% slot.
 * Every chip in prizePool is always accounted for (see the `second` note).
 */
export function rankAndPayout(entries: RankableEntry[], prizePool: number): RankedEntry[] {
  if (entries.length === 0) return [];

  // Exact complement (prizePool - first) rather than a second independent
  // round() — keeps first+second === prizePool exactly, no matter how the
  // rounding falls. With only one entrant total there's no "2nd place" slot
  // to reserve at all, so they take the entire pool.
  let first: number;
  let second: number;
  if (entries.length >= 2) {
    first = Math.round(prizePool * FIRST_PLACE_PCT);
    second = prizePool - first;
  } else {
    first = prizePool;
    second = 0;
  }
  const positionAmounts = [first, second, ...Array(Math.max(0, entries.length - 2)).fill(0)];

  const sorted = [...entries].sort(
    (a, b) => b.finalStack - a.finalStack || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  const result: RankedEntry[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].finalStack === sorted[i].finalStack) j++;
    const group = sorted.slice(i, j + 1);
    const groupAmount = positionAmounts.slice(i, j + 1).reduce((s, v) => s + v, 0);
    const split = splitEvenly(groupAmount, group.map((g) => g.id));
    const rank = i + 1;
    for (const g of group) {
      result.push({ id: g.id, finalStack: g.finalStack, rank, prize: split.get(g.id) ?? 0 });
    }
    i = j + 1;
  }
  return result;
}
