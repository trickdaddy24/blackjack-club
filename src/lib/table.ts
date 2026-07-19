// Shared-table lifecycle (multiplayer blackjack, v0.21.0). The Table row is
// the single source of truth: live round state rides in stateJson, next-round
// wagers in host/guest bet columns, and the 30s turn clock in turnDeadline
// (enforced lazily by whichever request arrives next — no cron).
//
// Money rules:
//  - each player stakes their own wagers; the deal debits BOTH in one tx
//  - per-player Round rows are written only at settle (solo carry skips them)
//  - insurance/even-money is never offered at shared tables (auto-declined)
//  - the Dealer Bust bet is solo-only

import { Prisma, type Table } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyAction,
  clientView,
  IllegalActionError,
  netResultForOwner,
  sideNetForOwner,
  startRound,
  type ClientView,
  type PlayerAction,
  type RoundState,
} from "@/lib/blackjack/engine";
import { effectivePromo } from "@/lib/promotions";
import { currentTableMinimum } from "@/lib/tableMinimum";
import {
  getLuckyLadiesJackpot,
  getPromoOverride,
  MAX_BET,
  MAX_SIDE_BET,
  settleLuckyLadiesPot,
} from "@/lib/game";
import { earnedThisSettle, nextWinStreak, type AchievementDef } from "@/lib/achievements";
import { awardAchievements } from "@/lib/game-achievements";
import { settleEventFor } from "@/lib/quests";
import { progressQuestsAtSettle } from "@/lib/quests-io";

export const TURN_SECONDS = 30;

export interface SideBets {
  pp: number;
  tp: number;
  ll: number;
}

export const NO_SIDES: SideBets = { pp: 0, tp: 0, ll: 0 };

export function parseSides(json: string | null): SideBets {
  if (!json) return NO_SIDES;
  try {
    const v = JSON.parse(json) as Partial<SideBets>;
    return { pp: v.pp ?? 0, tp: v.tp ?? 0, ll: v.ll ?? 0 };
  } catch {
    return NO_SIDES;
  }
}

export function sideTotal(s: SideBets): number {
  return s.pp + s.tp + s.ll;
}

/** The one non-ended table this user sits at (host or guest), if any. */
export async function getMemberTable(userId: string) {
  return prisma.table.findFirst({
    where: {
      status: { not: "ended" },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export function seatOf(table: Table, userId: string): 0 | 1 | null {
  if (table.hostId === userId) return 0;
  if (table.guestId === userId) return 1;
  return null;
}

function parseState(table: Table): RoundState | null {
  if (!table.stateJson) return null;
  try {
    return JSON.parse(table.stateJson) as RoundState;
  } catch {
    return null;
  }
}

/** Live = a dealt round that hasn't settled. */
export function liveRound(table: Table): RoundState | null {
  const s = parseState(table);
  return s && s.phase !== "settled" ? s : null;
}

const ownerUserId = (table: Table, owner: number) =>
  owner === 0 ? table.hostId : table.guestId!;

/** Σ this owner's main-game payouts (credited at settle). */
function mainPayoutFor(state: RoundState, owner: number): number {
  return state.hands
    .filter((h) => (h.owner ?? 0) === owner)
    .reduce((sum, h) => sum + h.payout, 0);
}

/** Σ this owner's instant side-bet payouts (credited at the deal). */
function sidePayoutFor(state: RoundState, owner: number): number {
  return state.hands
    .filter((h) => (h.owner ?? 0) === owner)
    .reduce(
      (sum, h) => sum + (h.pp?.payout ?? 0) + (h.tp?.payout ?? 0) + (h.ll?.payout ?? 0),
      0
    );
}

/** Owner whose hand hit the Lucky Ladies progressive (settled rounds). */
function jackpotOwner(state: RoundState): number | null {
  const hit = state.hands.find((h) => h.llJackpot);
  return hit ? (hit.owner ?? 0) : null;
}

export class TableError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/**
 * Settle-time bookkeeping for both players, inside the caller's transaction:
 * chip credits (delta computed by the caller per owner), streak columns, and
 * the per-player Round rows. Returns what the post-tx achievement pass needs.
 */
async function settleBothPlayers(
  tx: Prisma.TransactionClient,
  table: Table,
  state: RoundState,
  deltas: [number, number],
  jackpotWonBy: { owner: number; amount: number } | null
) {
  const results: {
    userId: string;
    owner: number;
    chipsAfter: number;
    paidThisSettle: number;
    newStreak: number;
  }[] = [];

  for (const owner of [0, 1]) {
    const userId = ownerUserId(table, owner);
    const roundNet = netResultForOwner(state, owner);
    const jackpotWon = jackpotWonBy?.owner === owner ? jackpotWonBy.amount : 0;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { winStreak: true, bestWinStreak: true },
    });
    const newStreak = nextWinStreak(user.winStreak, roundNet);
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        chips: { increment: deltas[owner as 0 | 1] },
        winStreak: newStreak,
        bestWinStreak: Math.max(user.bestWinStreak, newStreak),
      },
      select: { chips: true },
    });
    await tx.round.create({
      data: {
        userId,
        status: "settled",
        bet: state.hands.find((h) => (h.owner ?? 0) === owner)?.bet ?? 0,
        stateJson: JSON.stringify(state),
        netResult: roundNet,
        sideNet: sideNetForOwner(state, owner) + jackpotWon,
        tableId: table.id,
        settledAt: new Date(),
      },
    });
    results.push({
      userId,
      owner,
      chipsAfter: updated.chips,
      paidThisSettle: mainPayoutFor(state, owner) + jackpotWon,
      newStreak,
    });
  }
  return results;
}

/** Post-transaction achievement pass for both players (non-critical). */
async function awardBoth(
  state: RoundState,
  settled: Awaited<ReturnType<typeof settleBothPlayers>>,
  jackpotWonBy: { owner: number; amount: number } | null
): Promise<Map<string, AchievementDef[]>> {
  const out = new Map<string, AchievementDef[]>();
  for (const r of settled) {
    const roundsPlayed = await prisma.round.count({
      where: { userId: r.userId, status: "settled" },
    });
    const earned = earnedThisSettle({
      state,
      owner: r.owner,
      jackpotWon: jackpotWonBy?.owner === r.owner ? jackpotWonBy.amount : 0,
      chipsAfter: r.chipsAfter,
      chipsBeforePayout: r.chipsAfter - r.paidThisSettle,
      winStreak: r.newStreak,
      roundsPlayed,
    });
    out.set(r.userId, await awardAchievements(r.userId, earned));
    await progressQuestsAtSettle(r.userId, settleEventFor(state, r.owner));
  }
  return out;
}

/** Auto-decline insurance/even-money — never offered at shared tables. */
function declineInsurance(state: RoundState): RoundState {
  let s = state;
  let guard = 0;
  while (s.phase === "insurance" && guard++ < 4) {
    const actions = clientView(s).actions;
    const decline: PlayerAction = actions.includes("even-money-no")
      ? "even-money-no"
      : "insurance-no";
    s = applyAction(s, decline).state;
  }
  return s;
}

export interface BetInput {
  bet: number;
  sides: SideBets;
}

/** Validate a wager against the live floor rules. Throws TableError. */
export function validateWager(input: BetInput) {
  const tableMin = currentTableMinimum();
  const { bet, sides } = input;
  if (!Number.isInteger(bet) || bet < tableMin.min || bet > MAX_BET) {
    throw new TableError(
      `Table minimum is ${tableMin.min} right now (${tableMin.label}) — bet must be a whole number between ${tableMin.min} and ${MAX_BET}`
    );
  }
  for (const [name, v] of Object.entries(sides)) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_SIDE_BET) {
      throw new TableError(`${name} side bet must be 0 to ${MAX_SIDE_BET}`);
    }
  }
}

/**
 * Record a player's next-round wager; when both seats have wagered, deal.
 * Returns fresh table + any achievements unlocked on a deal-settled round.
 */
export async function placeTableBet(
  table: Table,
  userId: string,
  input: BetInput
): Promise<{ table: Table; unlocked: Map<string, AchievementDef[]> }> {
  const seat = seatOf(table, userId);
  if (seat === null) throw new TableError("Not your table", 404);
  if (table.status !== "active" || !table.guestId) {
    throw new TableError("The table needs both players seated", 409);
  }
  if (liveRound(table)) throw new TableError("A round is already in progress", 409);
  validateWager(input);

  const myStake = input.bet + sideTotal(input.sides);
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { chips: true },
  });
  if (me.chips < myStake) throw new TableError("Not enough chips", 400);

  // Record my wager (idempotent overwrite until the deal fires)
  const wagerData =
    seat === 0
      ? { hostBet: input.bet, hostSideJson: JSON.stringify(input.sides) }
      : { guestBet: input.bet, guestSideJson: JSON.stringify(input.sides) };
  const claimed = await prisma.table.updateMany({
    where: { id: table.id, updatedAt: table.updatedAt },
    data: wagerData,
  });
  if (claimed.count === 0) throw new TableError("Table changed — try again", 409);

  const fresh = await prisma.table.findUniqueOrThrow({ where: { id: table.id } });
  if (fresh.hostBet <= 0 || fresh.guestBet <= 0) {
    return { table: fresh, unlocked: new Map() }; // waiting on the other seat
  }
  return dealTableRound(fresh);
}

/** Both wagers are in — deal the shared round, debiting both players. */
async function dealTableRound(
  table: Table
): Promise<{ table: Table; unlocked: Map<string, AchievementDef[]> }> {
  const hostSides = parseSides(table.hostSideJson);
  const guestSides = parseSides(table.guestSideJson);
  const promo = effectivePromo(await getPromoOverride());
  const stakes: [number, number] = [
    table.hostBet + sideTotal(hostSides),
    table.guestBet + sideTotal(guestSides),
  ];

  // Shared shoe carries from the table's previous round
  const prev = parseState(table);
  let result;
  try {
    result = startRound(table.hostBet, {
      previousShoe: prev?.shoe ?? null,
      previousVariant: prev?.variant ?? "classic",
      previousCount: prev?.runningCount ?? 0,
      seats: 2,
      seatBets: [table.hostBet, table.guestBet],
      seatSideBets: [hostSides, guestSides],
      promo: promo?.id ?? null,
    });
  } catch (err) {
    if (err instanceof IllegalActionError) throw new TableError(err.message);
    throw err;
  }

  let state = declineInsurance(result.state);
  const settled = state.phase === "settled";
  const shuffled = result.shuffled === true;

  // Lucky Ladies pot: both stakes feed it; a hit pays that hand's owner
  const llContribution = hostSides.ll + guestSides.ll;
  let jackpotWonBy: { owner: number; amount: number } | null = null;
  if (llContribution > 0) {
    const hit = settled ? jackpotOwner(state) : null;
    const { won } = await settleLuckyLadiesPot(llContribution, hit !== null);
    if (hit !== null && won > 0) jackpotWonBy = { owner: hit, amount: won };
  }

  let unlocked = new Map<string, AchievementDef[]>();
  const stateJson = JSON.stringify(state);

  if (settled) {
    const settledInfo = await prisma.$transaction(async (tx) => {
      const claimed = await tx.table.updateMany({
        where: { id: table.id, updatedAt: table.updatedAt, hostBet: table.hostBet },
        data: {
          stateJson,
          hostBet: 0,
          guestBet: 0,
          hostSideJson: null,
          guestSideJson: null,
          turnDeadline: null,
        },
      });
      if (claimed.count === 0) throw new TableError("Table changed — try again", 409);
      const deltas: [number, number] = [0, 1].map(
        (o) =>
          -stakes[o as 0 | 1] +
          sidePayoutFor(state, o) +
          mainPayoutFor(state, o) +
          (jackpotWonBy?.owner === o ? jackpotWonBy.amount : 0)
      ) as [number, number];
      return settleBothPlayers(tx, table, state, deltas, jackpotWonBy);
    });
    unlocked = await awardBoth(state, settledInfo, jackpotWonBy);
  } else {
    // Debit both stakes + instant side payouts; round plays on
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.table.updateMany({
        where: { id: table.id, updatedAt: table.updatedAt, hostBet: table.hostBet },
        data: {
          stateJson,
          hostBet: 0,
          guestBet: 0,
          hostSideJson: null,
          guestSideJson: null,
          turnDeadline: new Date(Date.now() + TURN_SECONDS * 1000),
        },
      });
      if (claimed.count === 0) throw new TableError("Table changed — try again", 409);
      for (const o of [0, 1] as const) {
        const delta = -stakes[o] + sidePayoutFor(state, o);
        const u = await tx.user.findUniqueOrThrow({
          where: { id: ownerUserId(table, o) },
          select: { chips: true },
        });
        if (u.chips < stakes[o]) {
          throw new TableError(
            o === 0 ? "Host can no longer afford the wager" : "Guest can no longer afford the wager",
            409
          );
        }
        await tx.user.update({
          where: { id: ownerUserId(table, o) },
          data: { chips: { increment: delta } },
        });
      }
    });
  }

  void shuffled; // shuffle overlay is a solo nicety — table UI skips it
  const freshTable = await prisma.table.findUniqueOrThrow({ where: { id: table.id } });
  return { table: freshTable, unlocked };
}

/**
 * A player action on the live round. Turn-locked: only the owner of the
 * active hand may act. Doubles/splits debit the actor. Settles when done.
 */
export async function applyTableAction(
  table: Table,
  userId: string,
  action: PlayerAction
): Promise<{ table: Table; unlocked: Map<string, AchievementDef[]> }> {
  const seat = seatOf(table, userId);
  if (seat === null) throw new TableError("Not your table", 404);
  const state = liveRound(table);
  if (!state) throw new TableError("No round in progress", 404);
  if (state.phase !== "player") throw new TableError("Nothing to decide", 409);
  const activeOwner = state.hands[state.active]?.owner ?? 0;
  if (activeOwner !== seat) throw new TableError("Not your turn", 409);
  if (action === "insurance-yes" || action === "even-money-yes") {
    throw new TableError("Insurance is not offered at shared tables", 409);
  }

  let result;
  try {
    result = applyAction(state, action);
  } catch (err) {
    if (err instanceof IllegalActionError) throw new TableError(err.message, 409);
    throw err;
  }
  const { state: next, debit } = result;

  if (debit > 0) {
    const me = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { chips: true },
    });
    if (me.chips < debit) throw new TableError("Not enough chips", 400);
  }

  return persistProgress(table, next, { actorId: userId, actorDebit: debit });
}

/**
 * Lazy turn-clock enforcement: if the deadline passed, the active hand
 * auto-stands (one hand per call — the next poll catches the next one).
 */
export async function enforceTurnDeadline(
  table: Table
): Promise<{ table: Table; unlocked: Map<string, AchievementDef[]>; enforced: boolean }> {
  const state = liveRound(table);
  if (
    !state ||
    state.phase !== "player" ||
    !table.turnDeadline ||
    table.turnDeadline.getTime() > Date.now()
  ) {
    return { table, unlocked: new Map(), enforced: false };
  }
  const { state: next } = applyAction(state, "stand");
  const res = await persistProgress(table, next, null);
  return { ...res, enforced: true };
}

/** Persist a post-action state; runs full settle bookkeeping when done. */
async function persistProgress(
  table: Table,
  next: RoundState,
  actor: { actorId: string; actorDebit: number } | null
): Promise<{ table: Table; unlocked: Map<string, AchievementDef[]> }> {
  const settled = next.phase === "settled";
  const stateJson = JSON.stringify(next);

  // Jackpot can land here too (post-deal settle with a QoH pair + dealer BJ
  // was already paid at deal; this covers nothing new for LL — pot stakes
  // were fed at the deal, and llJackpot is only set when the dealer has BJ,
  // which always settles AT the deal in a no-insurance table. Kept for
  // engine-order safety.)
  let jackpotWonBy: { owner: number; amount: number } | null = null;
  if (settled) {
    const hit = jackpotOwner(next);
    if (hit !== null) {
      const { won } = await settleLuckyLadiesPot(0, true);
      if (won > 0) jackpotWonBy = { owner: hit, amount: won };
    }
  }

  let unlocked = new Map<string, AchievementDef[]>();
  const settledInfo = await prisma.$transaction(async (tx) => {
    const claimed = await tx.table.updateMany({
      where: { id: table.id, updatedAt: table.updatedAt },
      data: {
        stateJson,
        turnDeadline: settled ? null : new Date(Date.now() + TURN_SECONDS * 1000),
      },
    });
    if (claimed.count === 0) throw new TableError("Table changed — try again", 409);

    if (actor && actor.actorDebit > 0) {
      await tx.user.update({
        where: { id: actor.actorId },
        data: { chips: { decrement: actor.actorDebit } },
      });
    }
    if (!settled) return null;
    const deltas: [number, number] = [0, 1].map(
      (o) =>
        mainPayoutFor(next, o) +
        (jackpotWonBy?.owner === o ? jackpotWonBy.amount : 0)
    ) as [number, number];
    return settleBothPlayers(tx, table, next, deltas, jackpotWonBy);
  });
  if (settledInfo) unlocked = await awardBoth(next, settledInfo, jackpotWonBy);

  const fresh = await prisma.table.findUniqueOrThrow({ where: { id: table.id } });
  return { table: fresh, unlocked };
}

// ---------------------------------------------------------------------------
// The per-viewer table view
// ---------------------------------------------------------------------------

export interface TableView {
  tableId: string;
  status: string;
  gameType: string;
  youAre: "host" | "guest";
  host: { name: string; betPlaced: boolean };
  guest: { name: string; betPlaced: boolean } | null;
  round: ClientView | null;
  roundLive: boolean;
  /** Whose seat is acting + the server clock, when a round is live. */
  turn: { seat: number; deadline: string | null; secondsLeft: number | null } | null;
  chips: number;
  jackpot: number;
  tableMin: { min: number; label: string };
  maxSideBet: number;
}

export async function buildTableView(table: Table, viewerId: string): Promise<TableView> {
  const seat = seatOf(table, viewerId);
  if (seat === null) throw new TableError("Not your table", 404);

  const ids = [table.hostId, table.guestId].filter((x): x is string => Boolean(x));
  const [users, viewer, jackpot] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: viewerId },
      select: { chips: true },
    }),
    getLuckyLadiesJackpot(),
  ]);
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? "Player"]));

  const state = parseState(table);
  const live = state !== null && state.phase !== "settled";
  const activeOwner = live && state!.phase === "player" ? (state!.hands[state!.active]?.owner ?? 0) : null;
  const min = currentTableMinimum();

  return {
    tableId: table.id,
    status: table.status,
    gameType: table.gameType,
    youAre: seat === 0 ? "host" : "guest",
    host: { name: nameOf.get(table.hostId) ?? "Host", betPlaced: table.hostBet > 0 },
    guest: table.guestId
      ? { name: nameOf.get(table.guestId) ?? "Guest", betPlaced: table.guestBet > 0 }
      : null,
    round: state ? clientView(state) : null,
    roundLive: live,
    turn:
      activeOwner !== null
        ? {
            seat: activeOwner,
            deadline: table.turnDeadline?.toISOString() ?? null,
            secondsLeft: table.turnDeadline
              ? Math.max(0, Math.round((table.turnDeadline.getTime() - Date.now()) / 1000))
              : null,
          }
        : null,
    chips: viewer.chips,
    jackpot,
    tableMin: { min: min.min, label: min.label },
    maxSideBet: MAX_SIDE_BET,
  };
}
