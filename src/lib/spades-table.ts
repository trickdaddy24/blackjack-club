// Spades multiplayer table lifecycle (v0.48.0) — mirrors lib/table.ts's
// role for the blackjack Duo table, but for a 4-seat partnership Spades
// table. The SpadesTable row is the single source of truth: the full
// GameState rides in stateJson (server-authoritative, exactly like
// Table.stateJson) and the 30s turn clock in turnDeadline, enforced lazily
// by whichever request arrives next — same no-cron convention as Invite
// expiry and the blackjack turn clock.
//
// Pure engine logic (the reducer, bot heuristics, the per-seat clientView,
// the bot/timeout auto-action) lives in src/spades/engine/ and stays
// Prisma-free so vitest can load it directly — same split this codebase
// already uses for tournaments (lib/tournament.ts vs lib/tournament-io.ts).
// This file is the IO half: DB reads/writes and the seat/turn bookkeeping
// around those pure calls.
//
// Seats: 0 & 2 are always human (host = 0, guest = 2 — partners, since the
// engine's teamOf(seat) = seat % 2 pairs 0&2 vs 1&3); 1 & 3 are always
// bots. No lobby, no variable headcount — the table auto-starts (deals the
// first hand) the instant the invited guest accepts.

import type { SpadesTable } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { TURN_SECONDS } from "@/lib/table";
import { autoAct, HUMAN_SEATS, resolveBotTurns } from "@/spades/engine/auto";
import type { Card } from "@/spades/engine/cards";
import { spadesClientView, type SpadesClientView } from "@/spades/engine/clientView";
import { dealNextHand, newGame, placeBid, playCard } from "@/spades/engine/game";
import type { Bid, GameState, Seat } from "@/spades/engine/types";

export class SpadesTableError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/** The one non-ended Spades table this user sits at (host or guest), if any. */
export async function getMemberSpadesTable(userId: string) {
  return prisma.spadesTable.findFirst({
    where: {
      status: { not: "ended" },
      OR: [{ hostId: userId }, { guestId: userId }],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Host sits seat 0, guest sits seat 2 — the engine's own partnership pairing. */
export function seatOfSpades(table: SpadesTable, userId: string): 0 | 2 | null {
  if (table.hostId === userId) return 0;
  if (table.guestId === userId) return 2;
  return null;
}

function parseState(table: SpadesTable): GameState | null {
  if (!table.stateJson) return null;
  try {
    return JSON.parse(table.stateJson) as GameState;
  } catch {
    return null;
  }
}

/** Bidding/playing keeps the 30s clock running on whichever human seat is up
 *  next; any other phase (deal not yet made, hand/game over) has no clock. */
function nextDeadline(state: GameState): Date | null {
  return state.phase === "bidding" || state.phase === "playing"
    ? new Date(Date.now() + TURN_SECONDS * 1000)
    : null;
}

/** Open a fresh table (host = seat 0). One non-ended table per player. */
export async function openSpadesTable(hostId: string): Promise<SpadesTable> {
  return prisma.spadesTable.create({ data: { hostId } });
}

/**
 * Seat the invited guest (seat 2) and immediately deal the first hand —
 * headcount is always fixed at exactly 4 (2 human + 2 bot) the instant the
 * second human seats, so there's no separate "host clicks start" step the
 * way Tournaments needs one (variable 3-8 headcount there; fixed 4 here).
 * Resolves any bot turns from the deal (bots sit at 1 & 3 and can be first
 * to bid) before the row is ever read back.
 */
export async function joinSpadesTable(spadesTableId: string, userId: string): Promise<SpadesTable> {
  const seated = await prisma.spadesTable.updateMany({
    where: { id: spadesTableId, status: "open", guestId: null },
    data: { guestId: userId, status: "active" },
  });
  if (seated.count === 0) {
    throw new SpadesTableError("That table is no longer open", 410);
  }

  const dealt = resolveBotTurns(newGame());
  await prisma.spadesTable.update({
    where: { id: spadesTableId },
    data: { stateJson: JSON.stringify(dealt), turnDeadline: nextDeadline(dealt) },
  });
  return prisma.spadesTable.findUniqueOrThrow({ where: { id: spadesTableId } });
}

/**
 * Persist a post-action state: resolves any bot cascade first, sets the
 * next turn deadline (or clears it), and marks the table "ended" once a
 * team reaches the target score — v1 has no separate "end table" action,
 * so this is the only way a Spades table stops being the player's "current
 * table" (see getMemberSpadesTable). Optimistic concurrency via the
 * updatedAt guard, same convention as lib/table.ts, so two racing requests
 * (e.g. a poll's lazy timeout enforcement racing a real play) can't both
 * apply.
 */
async function persist(table: SpadesTable, next: GameState): Promise<SpadesTable> {
  const resolved = resolveBotTurns(next);
  const claimed = await prisma.spadesTable.updateMany({
    where: { id: table.id, updatedAt: table.updatedAt },
    data: {
      stateJson: JSON.stringify(resolved),
      turnDeadline: nextDeadline(resolved),
      ...(resolved.phase === "gameOver" ? { status: "ended", endedReason: "gameOver" } : {}),
    },
  });
  if (claimed.count === 0) throw new SpadesTableError("Table changed — try again", 409);
  return prisma.spadesTable.findUniqueOrThrow({ where: { id: table.id } });
}

function requireLiveGame(table: SpadesTable): GameState {
  const state = parseState(table);
  if (!state) throw new SpadesTableError("No game in progress", 404);
  return state;
}

/** A human seat's bid — turn-locked, phase-locked. */
export async function placeSpadesBid(table: SpadesTable, userId: string, bid: Bid): Promise<SpadesTable> {
  const seat = seatOfSpades(table, userId);
  if (seat === null) throw new SpadesTableError("Not your table", 404);
  const state = requireLiveGame(table);
  if (state.phase !== "bidding") throw new SpadesTableError("Not bidding right now", 409);
  if (state.turn !== seat) throw new SpadesTableError("Not your turn", 409);

  let next: GameState;
  try {
    next = placeBid(state, seat, bid);
  } catch (err) {
    throw new SpadesTableError(err instanceof Error ? err.message : "Illegal bid", 409);
  }
  return persist(table, next);
}

/** A human seat's card play — turn-locked, phase-locked, and the engine
 *  itself re-checks the card is actually in that seat's hand and legal to
 *  play (never trusts the client's claim). */
export async function playSpadesCard(table: SpadesTable, userId: string, card: Card): Promise<SpadesTable> {
  const seat = seatOfSpades(table, userId);
  if (seat === null) throw new SpadesTableError("Not your table", 404);
  const state = requireLiveGame(table);
  if (state.phase !== "playing") throw new SpadesTableError("Not playing right now", 409);
  if (state.turn !== seat) throw new SpadesTableError("Not your turn", 409);

  let next: GameState;
  try {
    next = playCard(state, seat, card);
  } catch (err) {
    throw new SpadesTableError(err instanceof Error ? err.message : "Illegal play", 409);
  }
  return persist(table, next);
}

/** Either partner can continue past a hand-result screen — no stakes are
 *  attached to who clicks it, mirroring the single-player "Deal next hand"
 *  button in src/spades/ui/panels.tsx. */
export async function dealNextSpadesHand(table: SpadesTable, userId: string): Promise<SpadesTable> {
  const seat = seatOfSpades(table, userId);
  if (seat === null) throw new SpadesTableError("Not your table", 404);
  const state = requireLiveGame(table);
  if (state.phase !== "handComplete") {
    throw new SpadesTableError("No hand result to continue from", 409);
  }
  return persist(table, dealNextHand(state));
}

/**
 * Lazy turn-clock enforcement: if a human seat's deadline passed, they get
 * forced through the bot AI's own recommended action (autoAct) — the same
 * heuristic that drives bot seats, not a separate arbitrary fallback. One
 * seat per call; the next poll catches anything further.
 */
export async function enforceSpadesTurnDeadline(table: SpadesTable): Promise<SpadesTable> {
  const state = parseState(table);
  if (!state || (state.phase !== "bidding" && state.phase !== "playing")) return table;
  if (!table.turnDeadline || table.turnDeadline.getTime() > Date.now()) return table;
  if (!HUMAN_SEATS.includes(state.turn)) return table; // defensive — persist() never parks on a bot seat

  const next = autoAct(state, state.turn);
  return persist(table, next);
}

// ---------------------------------------------------------------------------
// The per-viewer table view
// ---------------------------------------------------------------------------

export interface SpadesTableView {
  tableId: string;
  status: string;
  youAreSeat: 0 | 2;
  hostName: string;
  guestName: string | null;
  /** null until the guest has accepted and the first hand is dealt. */
  game: SpadesClientView | null;
  turnDeadline: string | null;
  secondsLeft: number | null;
}

export async function buildSpadesTableView(table: SpadesTable, viewerId: string): Promise<SpadesTableView> {
  const seat = seatOfSpades(table, viewerId);
  if (seat === null) throw new SpadesTableError("Not your table", 404);

  const ids = [table.hostId, table.guestId].filter((x): x is string => Boolean(x));
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? "Player"]));

  const state = parseState(table);

  return {
    tableId: table.id,
    status: table.status,
    youAreSeat: seat,
    hostName: nameOf.get(table.hostId) ?? "Host",
    guestName: table.guestId ? (nameOf.get(table.guestId) ?? "Guest") : null,
    // seat here is derived from the authenticated viewerId above — a client
    // can never ask to see a different seat's view.
    game: state ? spadesClientView(state, seat as Seat) : null,
    turnDeadline: table.turnDeadline?.toISOString() ?? null,
    secondsLeft: table.turnDeadline
      ? Math.max(0, Math.round((table.turnDeadline.getTime() - Date.now()) / 1000))
      : null,
  };
}
