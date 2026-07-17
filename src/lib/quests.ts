// Daily quests — the pure half. Catalog, deterministic daily rotation, and
// the progress math. IO lives in quests-io.ts so vitest loads this without
// Prisma. Rotation and progress both key off the Vegas calendar day.

import type { RoundState } from "./blackjack/engine";
import { netResult, netResultForOwner } from "./blackjack/engine";

export interface QuestDef {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  target: number;
  reward: number;
  /** "count" adds on a matching settle; "run" resets on a lost round. */
  kind: "count" | "run";
}

export const QUESTS: QuestDef[] = [
  { slug: "play-5", name: "Grinder's Shift", emoji: "🃏", description: "Settle 5 rounds today.", target: 5, reward: 500, kind: "count" },
  { slug: "win-3", name: "Triple Threat", emoji: "🏆", description: "Win 3 rounds today.", target: 3, reward: 750, kind: "count" },
  { slug: "run-2", name: "Back to Back", emoji: "🔥", description: "Win 2 rounds in a row.", target: 2, reward: 750, kind: "run" },
  { slug: "natural-1", name: "Snapper", emoji: "♠️", description: "Be dealt a blackjack.", target: 1, reward: 750, kind: "count" },
  { slug: "side-1", name: "Little Extra", emoji: "✨", description: "Win any side bet.", target: 1, reward: 500, kind: "count" },
  { slug: "double-1", name: "Press It", emoji: "⚡", description: "Win a hand you doubled.", target: 1, reward: 750, kind: "count" },
  { slug: "duo-1", name: "Bring a Friend", emoji: "👥", description: "Settle a round at a shared table.", target: 1, reward: 1000, kind: "count" },
  { slug: "bust-1", name: "Call the Bust", emoji: "🔮", description: "Win a Dealer Bust bet.", target: 1, reward: 1000, kind: "count" },
  { slug: "gym-1", name: "Hit the Gym", emoji: "💪", description: "Complete a counting drill in the Gym.", target: 1, reward: 500, kind: "count" },
];

const BY_SLUG = new Map(QUESTS.map((q) => [q.slug, q]));
export const questDef = (slug: string) => BY_SLUG.get(slug);

/**
 * Today's three quests: Grinder's Shift is always on the board (everyone can
 * finish it), plus two rotating picks seeded by the date key — same three
 * for every player, all day.
 */
export function dailyQuests(dayKey: string): QuestDef[] {
  const rest = QUESTS.filter((q) => q.slug !== "play-5");
  let seed = 0;
  for (const ch of dayKey) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const a = seed % rest.length;
  const b = (a + 1 + ((seed >> 5) % (rest.length - 1))) % rest.length;
  return [BY_SLUG.get("play-5")!, rest[a], rest[b]];
}

/** What one settled round meant for the player (per seat at shared tables). */
export interface SettleEvent {
  won: boolean;
  blackjack: boolean;
  sideWin: boolean;
  doubledWin: boolean;
  duo: boolean;
  bustWin: boolean;
  /** A Gym drill (not a table round) — table-only quests must ignore it. */
  gym?: boolean;
}

const WON = (o: string | null) => o === "win" || o === "blackjack" || o === "even-money";

export function settleEventFor(state: RoundState, owner?: number): SettleEvent {
  const scoped = owner !== undefined;
  const hands = scoped
    ? state.hands.filter((h) => (h.owner ?? 0) === owner)
    : state.hands;
  const bustWin = !scoped && (state.bustPayout ?? 0) > 0;
  return {
    won: (scoped ? netResultForOwner(state, owner!) : netResult(state)) > 0,
    blackjack: hands.some((h) => h.outcome === "blackjack" || h.outcome === "even-money"),
    sideWin:
      hands.some(
        (h) => (h.pp?.payout ?? 0) > 0 || (h.tp?.payout ?? 0) > 0 || (h.ll?.payout ?? 0) > 0
      ) || bustWin,
    doubledWin: hands.some((h) => h.doubled && WON(h.outcome)),
    duo: scoped,
    bustWin,
  };
}

/** New progress value for one quest given one settled round. */
export function advanceQuest(def: QuestDef, prev: number, ev: SettleEvent): number {
  switch (def.slug) {
    case "play-5":
      // Table rounds only — a gym drill is not a settled hand
      return ev.gym ? prev : prev + 1;
    case "win-3":
      return ev.won ? prev + 1 : prev;
    case "run-2":
      // Gym drills must not break a live win run either
      return ev.gym ? prev : ev.won ? prev + 1 : 0;
    case "natural-1":
      return ev.blackjack ? prev + 1 : prev;
    case "side-1":
      return ev.sideWin ? prev + 1 : prev;
    case "double-1":
      return ev.doubledWin ? prev + 1 : prev;
    case "duo-1":
      return ev.duo ? prev + 1 : prev;
    case "bust-1":
      return ev.bustWin ? prev + 1 : prev;
    case "gym-1":
      return ev.gym ? prev + 1 : prev;
    default:
      return prev;
  }
}

/** The pseudo-event a completed Gym drill emits into the quest engine. */
export const GYM_EVENT: SettleEvent = {
  won: false,
  blackjack: false,
  sideWin: false,
  doubledWin: false,
  duo: false,
  bustWin: false,
  gym: true,
};
