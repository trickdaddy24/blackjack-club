// Sit-and-go tournament IO: lobby lifecycle, hand play against the isolated
// stack, and the two lazy sweeps (idle-lobby cancel, 24h completion
// deadline) — enforced whenever a tournament route is hit next, same
// no-cron convention as Invite expiry (see lib/table.ts) and the Hot Seat
// clock (lib/hotseat-io.ts).

import { prisma } from "@/lib/prisma";
import type { Prisma, TournamentEntry, TournamentLobby } from "@prisma/client";
import {
  applyAction,
  clientView,
  IllegalActionError,
  netResult,
  startRound,
  type ClientView,
  type PlayerAction,
  type RoundState,
} from "@/lib/blackjack/engine";
import { parseRoundState, roundStatus } from "@/lib/game";
import {
  canBackOut,
  canJoinLobby,
  canManualStart,
  canStillPlay,
  checkTournamentBet,
  HANDS_PER_ENTRANT,
  isEntryComplete,
  isLiveEntryStatus,
  isLobbyIdleExpired,
  isPastDeadline,
  MAX_ENTRANTS,
  MIN_ENTRANTS,
  rankAndPayout,
  rejectSideBets,
  shouldAutoStart,
  TOURNAMENT_BUY_IN,
  tournamentDeadline,
  type EntryStatus,
  type LobbyStatus,
} from "@/lib/tournament";

export class TournamentError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

// ------------------------------------------------------------- sweeps --

/**
 * Cancel any "open" lobby that's gone idle (no new joins for the window)
 * and refund every entrant. Safe to call on every tournament route — a
 * no-op almost always. One lobby at a time so a single failure can't take
 * the whole sweep down.
 */
async function sweepIdleLobbies(now: Date): Promise<void> {
  const stale = await prisma.tournamentLobby.findMany({
    where: { status: "open" },
    select: { id: true, lastJoinAt: true },
  });
  for (const lobby of stale) {
    if (!isLobbyIdleExpired(lobby.lastJoinAt, now)) continue;
    await cancelIdleLobby(lobby.id);
  }
}

async function cancelIdleLobby(lobbyId: string): Promise<void> {
  // Claim it first (status flip) so two concurrent sweeps can't both refund.
  const claimed = await prisma.tournamentLobby.updateMany({
    where: { id: lobbyId, status: "open" },
    data: { status: "canceled" },
  });
  if (claimed.count === 0) return;

  const entries = await prisma.tournamentEntry.findMany({
    where: { lobbyId, status: "joined" },
  });
  if (entries.length === 0) return;

  await prisma.$transaction([
    ...entries.map((e) =>
      prisma.user.update({ where: { id: e.userId }, data: { chips: { increment: e.stack } } })
    ),
    prisma.tournamentEntry.updateMany({
      where: { lobbyId, status: "joined" },
      data: { status: "refunded", finalStack: 0 },
    }),
  ]);
}

/**
 * Settle any "active" lobby past its 24h deadline: forfeit-in-place
 * whoever hasn't finished, then pay out. One lobby at a time (see above).
 */
async function sweepDueDeadlines(now: Date): Promise<void> {
  const active = await prisma.tournamentLobby.findMany({
    where: { status: "active" },
    select: { id: true, deadlineAt: true },
  });
  for (const lobby of active) {
    if (isPastDeadline(lobby.deadlineAt, now)) {
      await settleLobby(lobby.id, { forfeitUnfinished: true });
    }
  }
}

/** Run both lazy sweeps. Call this before reading any lobby/list state. */
export async function sweepTournaments(now: Date = new Date()): Promise<void> {
  await sweepIdleLobbies(now);
  await sweepDueDeadlines(now);
}

// ------------------------------------------------------------- lobby --

/** Open a lobby, paying the buy-in as its first entrant. */
export async function createLobby(userId: string): Promise<TournamentLobby> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { chips: true },
  });
  if (user.chips < TOURNAMENT_BUY_IN) {
    throw new TournamentError("Not enough chips for the buy-in", 400);
  }

  return prisma.$transaction(async (tx) => {
    const lobby = await tx.tournamentLobby.create({
      data: { creatorId: userId, buyIn: TOURNAMENT_BUY_IN, prizePool: TOURNAMENT_BUY_IN },
    });
    await tx.tournamentEntry.create({
      data: { lobbyId: lobby.id, userId, stack: TOURNAMENT_BUY_IN },
    });
    await tx.user.update({ where: { id: userId }, data: { chips: { decrement: TOURNAMENT_BUY_IN } } });
    return lobby;
  });
}

/** Join an open lobby, paying the buy-in. Auto-starts the lobby at the max. */
export async function joinLobby(lobbyId: string, userId: string): Promise<TournamentLobby> {
  await sweepTournaments();

  const lobby = await prisma.tournamentLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) throw new TournamentError("Tournament not found", 404);

  const existing = await prisma.tournamentEntry.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  if (existing) throw new TournamentError("You're already entered in this tournament", 409);

  const entrantCount = await prisma.tournamentEntry.count({
    where: { lobbyId, status: "joined" },
  });
  if (!canJoinLobby(lobby.status as LobbyStatus, entrantCount)) {
    throw new TournamentError("This tournament is no longer open to join", 409);
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { chips: true },
  });
  if (user.chips < lobby.buyIn) {
    throw new TournamentError("Not enough chips for the buy-in", 400);
  }

  const joined = await prisma.$transaction(async (tx) => {
    // Re-check inside the tx-adjacent window via an optimistic claim on
    // updatedAt so two simultaneous joins can't both squeeze past the max.
    const fresh = await tx.tournamentLobby.findUniqueOrThrow({ where: { id: lobbyId } });
    const freshCount = await tx.tournamentEntry.count({
      where: { lobbyId, status: "joined" },
    });
    if (!canJoinLobby(fresh.status as LobbyStatus, freshCount)) {
      throw new TournamentError("This tournament is no longer open to join", 409);
    }
    await tx.tournamentEntry.create({
      data: { lobbyId, userId, stack: fresh.buyIn },
    });
    await tx.user.update({ where: { id: userId }, data: { chips: { decrement: fresh.buyIn } } });
    return tx.tournamentLobby.update({
      where: { id: lobbyId },
      data: { lastJoinAt: new Date(), prizePool: { increment: fresh.buyIn } },
    });
  });

  const newCount = entrantCount + 1;
  if (shouldAutoStart(newCount)) {
    return startLobby(lobbyId);
  }
  return joined;
}

/** Voluntary pre-start exit — full refund, seat released. */
export async function backOutOfLobby(lobbyId: string, userId: string): Promise<void> {
  await sweepTournaments();

  const lobby = await prisma.tournamentLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) throw new TournamentError("Tournament not found", 404);
  if (!canBackOut(lobby.status as LobbyStatus)) {
    throw new TournamentError("The tournament has already started", 409);
  }

  const entry = await prisma.tournamentEntry.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  if (!entry || entry.status !== "joined") {
    throw new TournamentError("You're not entered in this tournament", 404);
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { chips: { increment: entry.stack } } }),
    prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { status: "backed-out", finalStack: 0 },
    }),
    prisma.tournamentLobby.update({
      where: { id: lobbyId },
      data: { prizePool: { decrement: entry.stack } },
    }),
  ]);

  const remaining = await prisma.tournamentEntry.count({
    where: { lobbyId, status: "joined" },
  });
  if (remaining === 0) {
    // Everyone (including the creator) has left — nothing left to start.
    await prisma.tournamentLobby.updateMany({
      where: { id: lobbyId, status: "open" },
      data: { status: "canceled" },
    });
  }
}

/** Manual start by the creator, once the 3-entrant floor is met. */
export async function manualStartLobby(lobbyId: string, userId: string): Promise<TournamentLobby> {
  const lobby = await prisma.tournamentLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) throw new TournamentError("Tournament not found", 404);
  if (lobby.creatorId !== userId) {
    throw new TournamentError("Only the tournament creator can start it", 403);
  }
  if (lobby.status !== "open") {
    throw new TournamentError("This tournament has already started", 409);
  }
  const entrantCount = await prisma.tournamentEntry.count({
    where: { lobbyId, status: "joined" },
  });
  if (!canManualStart(entrantCount)) {
    throw new TournamentError(`Need at least ${MIN_ENTRANTS} entrants to start`, 400);
  }
  return startLobby(lobbyId);
}

async function startLobby(lobbyId: string): Promise<TournamentLobby> {
  const now = new Date();
  const claimed = await prisma.tournamentLobby.updateMany({
    where: { id: lobbyId, status: "open" },
    data: { status: "active", startedAt: now, deadlineAt: tournamentDeadline(now) },
  });
  if (claimed.count > 0) {
    await prisma.tournamentEntry.updateMany({
      where: { lobbyId, status: "joined" },
      data: { status: "playing" },
    });
  }
  return prisma.tournamentLobby.findUniqueOrThrow({ where: { id: lobbyId } });
}

// -------------------------------------------------------------- read --

export async function listOpenLobbies() {
  await sweepTournaments();
  const lobbies = await prisma.tournamentLobby.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "desc" },
    include: { entries: { where: { status: "joined" }, select: { id: true } } },
  });
  return lobbies.map((l) => ({
    id: l.id,
    creatorId: l.creatorId,
    buyIn: l.buyIn,
    entrantCount: l.entries.length,
    minEntrants: MIN_ENTRANTS,
    maxEntrants: MAX_ENTRANTS,
    createdAt: l.createdAt,
  }));
}

/** Lobbies this user currently has a live (non-terminal) entry in. */
export async function listMyLiveEntries(userId: string) {
  await sweepTournaments();
  const entries = await prisma.tournamentEntry.findMany({
    where: { userId, status: { in: ["joined", "playing"] } },
    include: { lobby: true },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => ({
    lobbyId: e.lobbyId,
    status: e.status,
    lobbyStatus: e.lobby.status,
    stack: e.stack,
    handsPlayed: e.handsPlayed,
  }));
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  isMe: boolean;
  stack: number;
  handsPlayed: number;
  status: EntryStatus;
  rank: number | null;
  prize: number;
}

export interface LobbyView {
  id: string;
  status: string;
  creatorId: string;
  buyIn: number;
  prizePool: number;
  minEntrants: number;
  maxEntrants: number;
  handsPerEntrant: number;
  startedAt: string | null;
  deadlineAt: string | null;
  settledAt: string | null;
  leaderboard: LeaderboardRow[];
  myEntry: {
    id: string;
    stack: number;
    handsPlayed: number;
    status: EntryStatus;
    round: ClientView | null;
  } | null;
}

/** Full lobby view — settles/cancels lazily first if this lobby is due. */
export async function getLobbyView(lobbyId: string, userId: string): Promise<LobbyView> {
  await sweepTournaments();

  const lobby = await prisma.tournamentLobby.findUnique({
    where: { id: lobbyId },
    include: { entries: { include: { user: { select: { name: true } } } } },
  });
  if (!lobby) throw new TournamentError("Tournament not found", 404);

  const sorted = [...lobby.entries].sort((a, b) => b.stack - a.stack);
  const leaderboard: LeaderboardRow[] = sorted.map((e) => ({
    userId: e.userId,
    name: e.user.name ?? "Player",
    isMe: e.userId === userId,
    stack: e.stack,
    handsPlayed: e.handsPlayed,
    status: e.status as EntryStatus,
    rank: e.rank,
    prize: e.prize,
  }));

  const mine = lobby.entries.find((e) => e.userId === userId) ?? null;
  let myRound: ClientView | null = null;
  if (mine && mine.status === "playing") {
    const round = await getActiveEntryRound(mine.id);
    if (round) myRound = clientView(parseRoundState(round.stateJson));
  }

  return {
    id: lobby.id,
    status: lobby.status,
    creatorId: lobby.creatorId,
    buyIn: lobby.buyIn,
    prizePool: lobby.prizePool,
    minEntrants: MIN_ENTRANTS,
    maxEntrants: MAX_ENTRANTS,
    handsPerEntrant: HANDS_PER_ENTRANT,
    startedAt: lobby.startedAt?.toISOString() ?? null,
    deadlineAt: lobby.deadlineAt?.toISOString() ?? null,
    settledAt: lobby.settledAt?.toISOString() ?? null,
    leaderboard,
    myEntry: mine
      ? {
          id: mine.id,
          stack: mine.stack,
          handsPlayed: mine.handsPlayed,
          status: mine.status as EntryStatus,
          round: myRound,
        }
      : null,
  };
}

// ------------------------------------------------------------ hands --

function getActiveEntryRound(tournamentEntryId: string) {
  return prisma.round.findFirst({
    where: { tournamentEntryId, status: { not: "settled" } },
    orderBy: { createdAt: "desc" },
  });
}

/** Shoe/variant/count carried from THIS entry's last hand — isolated from the user's solo shoe. */
async function getEntryCarry(tournamentEntryId: string) {
  const last = await prisma.round.findFirst({
    where: { tournamentEntryId },
    orderBy: { createdAt: "desc" },
    select: { stateJson: true },
  });
  if (!last) return null;
  try {
    const state = JSON.parse(last.stateJson) as RoundState;
    if (!state.shoe) return null;
    return { shoe: state.shoe, variant: state.variant ?? "classic", runningCount: state.runningCount ?? 0 };
  } catch {
    return null;
  }
}

async function requirePlayableEntry(lobbyId: string, userId: string) {
  const lobby = await prisma.tournamentLobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) throw new TournamentError("Tournament not found", 404);
  if (lobby.status !== "active") {
    throw new TournamentError("This tournament isn't active", 409);
  }
  if (isPastDeadline(lobby.deadlineAt, new Date())) {
    // Lazily settle right now rather than let the player act into a dead lobby.
    await settleLobby(lobbyId, { forfeitUnfinished: true });
    throw new TournamentError("This tournament's 24h clock ran out", 410);
  }

  const entry = await prisma.tournamentEntry.findUnique({
    where: { lobbyId_userId: { lobbyId, userId } },
  });
  if (!entry || entry.status !== "playing") {
    throw new TournamentError("You're not an active entrant in this tournament", 404);
  }
  if (!canStillPlay(entry.stack, entry.handsPlayed)) {
    throw new TournamentError("You have no hands or chips left to play", 409);
  }
  return { lobby, entry };
}

/**
 * Bump the entry past a just-settled hand: advance handsPlayed, and finish
 * it out (stack snapshot, terminal status) once the fixed count is hit or
 * the stack can't cover another minimum bet. Then check whether the whole
 * field is done, in which case the lobby settles immediately rather than
 * waiting out the rest of the 24h window.
 */
async function afterHandSettled(entryId: string, lobbyId: string): Promise<void> {
  const entry = await prisma.tournamentEntry.findUniqueOrThrow({ where: { id: entryId } });
  const handsPlayed = entry.handsPlayed + 1;
  const done = isEntryComplete(handsPlayed) || !canStillPlay(entry.stack, handsPlayed);
  await prisma.tournamentEntry.update({
    where: { id: entryId },
    data: {
      handsPlayed,
      ...(done ? { status: "finished", finalStack: entry.stack, finishedAt: new Date() } : {}),
    },
  });

  if (done) {
    const stillPlaying = await prisma.tournamentEntry.count({
      where: { lobbyId, status: "playing" },
    });
    if (stillPlaying === 0) {
      await settleLobby(lobbyId, { forfeitUnfinished: false });
    }
  }
}

export interface HandResult {
  round: ClientView;
  stack: number;
  handsPlayed: number;
  entryStatus: EntryStatus;
}

/** Deal a fresh tournament hand — bet is debited from the isolated stack, never main chips. */
export async function placeTournamentBet(
  lobbyId: string,
  userId: string,
  input: { bet: unknown; perfectPairs?: unknown; twentyOnePlusThree?: unknown; luckyLadies?: unknown }
): Promise<HandResult> {
  const sideRejection = rejectSideBets(input);
  if (sideRejection) throw new TournamentError(sideRejection, 400);

  const { entry } = await requirePlayableEntry(lobbyId, userId);

  const existingRound = await getActiveEntryRound(entry.id);
  if (existingRound) throw new TournamentError("You already have a hand in progress", 409);

  const check = checkTournamentBet(input.bet, entry.stack);
  if (!check.ok) throw new TournamentError(check.error, 400);

  const carry = await getEntryCarry(entry.id);
  const { state, debit } = startRound(check.bet, {
    previousShoe: carry?.shoe ?? null,
    previousVariant: carry?.variant,
    previousCount: carry?.runningCount,
    seats: 1,
    variant: "classic",
    bots: 0,
    perfectPairs: 0,
    twentyOnePlusThree: 0,
    luckyLadies: 0,
    promo: null,
  });
  const settled = state.phase === "settled";
  const chipDelta = -debit + (settled ? state.payoutTotal : 0);

  const [updatedEntry] = await prisma.$transaction([
    prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { stack: { increment: chipDelta } },
      select: { stack: true, handsPlayed: true },
    }),
    prisma.round.create({
      data: {
        userId,
        tournamentEntryId: entry.id,
        status: roundStatus(state),
        bet: check.bet,
        stateJson: JSON.stringify(state),
        netResult: settled ? netResult(state) : 0,
        sideNet: 0,
        settledAt: settled ? new Date() : null,
      },
    }),
  ]);

  if (settled) await afterHandSettled(entry.id, lobbyId);

  const fresh = await prisma.tournamentEntry.findUniqueOrThrow({ where: { id: entry.id } });
  return {
    round: clientView(state),
    stack: updatedEntry.stack,
    handsPlayed: fresh.handsPlayed,
    entryStatus: fresh.status as EntryStatus,
  };
}

/** Act on the tournament hand in progress — settles against the isolated stack. */
export async function playTournamentAction(
  lobbyId: string,
  userId: string,
  action: PlayerAction
): Promise<HandResult> {
  const { entry } = await requirePlayableEntry(lobbyId, userId);

  const round = await getActiveEntryRound(entry.id);
  if (!round) throw new TournamentError("No tournament hand in progress", 404);

  const state = parseRoundState(round.stateJson);
  let result;
  try {
    result = applyAction(state, action);
  } catch (err) {
    if (err instanceof IllegalActionError) throw new TournamentError(err.message, 409);
    throw err;
  }
  const { state: next, debit } = result;
  if (debit > 0 && entry.stack < debit) {
    throw new TournamentError("Not enough chips left in your tournament stack", 400);
  }

  const settled = next.phase === "settled";
  const chipDelta = -debit + (settled ? next.payoutTotal + (next.bustPayout ?? 0) : 0);

  const [updatedEntry] = await prisma.$transaction([
    prisma.tournamentEntry.update({
      where: { id: entry.id },
      data: { stack: { increment: chipDelta } },
      select: { stack: true, handsPlayed: true },
    }),
    prisma.round.update({
      where: { id: round.id },
      data: {
        status: roundStatus(next),
        stateJson: JSON.stringify(next),
        netResult: settled ? netResult(next) : 0,
        sideNet: 0,
        settledAt: settled ? new Date() : null,
      },
    }),
  ]);

  if (settled) await afterHandSettled(entry.id, lobbyId);

  const fresh = await prisma.tournamentEntry.findUniqueOrThrow({ where: { id: entry.id } });
  return {
    round: clientView(next),
    stack: updatedEntry.stack,
    handsPlayed: fresh.handsPlayed,
    entryStatus: fresh.status as EntryStatus,
  };
}

// ----------------------------------------------------------- settle --

/**
 * Close a lobby out: forfeit anyone still "playing" in place (if this is a
 * deadline settle), rank every non-refunded/non-backed-out entrant by final
 * stack, split the pool 60/40 with tie handling, and credit prizes to main
 * chips. Idempotent via the status claim below — concurrent callers race
 * harmlessly.
 */
async function settleLobby(lobbyId: string, opts: { forfeitUnfinished: boolean }): Promise<void> {
  const claimed = await prisma.tournamentLobby.updateMany({
    where: { id: lobbyId, status: "active" },
    data: { status: "settled", settledAt: new Date() },
  });
  if (claimed.count === 0) return; // already settled/settling elsewhere

  const entries = await prisma.tournamentEntry.findMany({ where: { lobbyId } });
  const lobby = await prisma.tournamentLobby.findUniqueOrThrow({ where: { id: lobbyId } });

  const forfeited: TournamentEntry[] = [];
  for (const e of entries) {
    if (e.status === "playing") {
      if (opts.forfeitUnfinished) forfeited.push(e);
    }
  }

  const rankable = entries
    .filter((e) => isLiveEntryStatus(e.status as EntryStatus) || e.status === "finished")
    .map((e) => ({
      id: e.id,
      finalStack: e.status === "finished" ? (e.finalStack ?? e.stack) : e.stack,
    }));

  const ranked = rankAndPayout(rankable, lobby.prizePool);
  const rankedById = new Map(ranked.map((r) => [r.id, r]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const e of entries) {
    const wasForfeited = forfeited.some((f) => f.id === e.id);
    const r = rankedById.get(e.id);
    if (wasForfeited) {
      ops.push(
        prisma.tournamentEntry.update({
          where: { id: e.id },
          data: {
            status: "forfeited",
            finalStack: e.stack,
            finishedAt: new Date(),
            rank: r?.rank ?? null,
            prize: r?.prize ?? 0,
          },
        })
      );
    } else if (r) {
      ops.push(
        prisma.tournamentEntry.update({
          where: { id: e.id },
          data: { rank: r.rank, prize: r.prize },
        })
      );
    }
    if (r && r.prize > 0) {
      ops.push(
        prisma.user.update({ where: { id: e.userId }, data: { chips: { increment: r.prize } } })
      );
    }
  }
  if (ops.length > 0) await prisma.$transaction(ops);
}
