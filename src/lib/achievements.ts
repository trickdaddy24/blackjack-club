// Achievements — the catalog and the pure earn-checks. No I/O here: the API
// routes build a SettleContext from data they already have, call
// `earnedThisSettle`, and persist/award the diff (see awardAchievements in
// lib/game-achievements.ts). Trophy names/art live only in this file, so the
// DB stores nothing but (userId, slug, unlockedAt).

// Relative import (not "@/") so vitest can load this module without the
// Next.js alias — same convention as the rest of src/lib.
import { netResult, netResultForOwner, type RoundState } from "./blackjack/engine";

export interface AchievementDef {
  slug: string;
  name: string;
  emoji: string;
  /** Shown in the trophy case — how to earn it (visible even when locked). */
  description: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { slug: "first-hand", name: "Welcome to the Club", emoji: "🎰", description: "Settle your first round at the table." },
  { slug: "natural", name: "The Natural", emoji: "🃏", description: "Be dealt a blackjack." },
  { slug: "double-win", name: "Double Trouble", emoji: "⚡", description: "Win a hand you doubled down on." },
  { slug: "split-sweep", name: "Split Personality", emoji: "✌️", description: "Split a pair and win every resulting hand." },
  { slug: "hot-streak-5", name: "Heating Up", emoji: "🔥", description: "Win 5 rounds in a row (pushes don't break the run)." },
  { slug: "hot-streak-10", name: "On Fire", emoji: "🌋", description: "Win 10 rounds in a row." },
  { slug: "comeback-kid", name: "Comeback Kid", emoji: "🦅", description: "Win a round with fewer than 1,000 chips behind your bet." },
  { slug: "all-in-win", name: "Nerves of Steel", emoji: "🎲", description: "Push every last chip across the line — and win." },
  { slug: "high-roller-100k", name: "High Roller", emoji: "💰", description: "Grow your stack to 100,000 chips." },
  { slug: "millionaire", name: "Chip Millionaire", emoji: "🏦", description: "Grow your stack to 1,000,000 chips." },
  { slug: "side-show", name: "Side Show", emoji: "✨", description: "Win any side bet." },
  { slug: "perfect-pair", name: "Perfect Match", emoji: "💎", description: "Hit the 30:1 Perfect Pair." },
  { slug: "suited-trips", name: "Trip Threat", emoji: "🎯", description: "Hit 100:1 suited trips on 21+3." },
  { slug: "queens-crown", name: "The Queen's Crown", emoji: "👑", description: "Win the Lucky Ladies progressive jackpot." },
  { slug: "bust-prophet", name: "Bust Prophet", emoji: "🔮", description: "Call a dealer bust and cash the Dealer Bust bet." },
  { slug: "golden-hour", name: "Golden Hour", emoji: "🥂", description: "Land a 2:1 blackjack during Happy Hour." },
  { slug: "grinder-100", name: "Regular", emoji: "♠️", description: "Play 100 rounds." },
  { slug: "grinder-1000", name: "House Fixture", emoji: "🪑", description: "Play 1,000 rounds." },
  { slug: "book-smart-25", name: "Book Smart", emoji: "📖", description: "Make 25 correct blind decisions in a row with the trainer on." },
  { slug: "by-the-book", name: "By the Book", emoji: "🎓", description: "Hold 90%+ blind accuracy over 100+ graded decisions." },
  { slug: "board-champion", name: "Board Champion", emoji: "👑", description: "Top a daily or weekly leaderboard when the window closes." },
];

const BY_SLUG = new Map(ACHIEVEMENTS.map((a) => [a.slug, a]));

export function achievementDef(slug: string): AchievementDef | undefined {
  return BY_SLUG.get(slug);
}

/** Everything the settle-time checks need — assembled by the API routes. */
export interface SettleContext {
  state: RoundState;
  /** Lucky Ladies progressive paid this settle (0 = no hit). */
  jackpotWon: number;
  /** Stack after all of this settle's credits landed. */
  chipsAfter: number;
  /** Stack the moment before settle credits — i.e. what wasn't on the table. */
  chipsBeforePayout: number;
  /** Win streak AFTER this round's result was applied. */
  winStreak: number;
  /** Lifetime settled rounds INCLUDING this one. */
  roundsPlayed: number;
  /** Multiplayer: scope the checks to this seat's hands and net (solo = unset). */
  owner?: number;
}

const WON = (o: string | null) => o === "win" || o === "blackjack" || o === "even-money";

/**
 * Pure: which achievement slugs does this settled round satisfy?
 * The caller diffs against already-unlocked rows; re-earning is a no-op.
 */
export function earnedThisSettle(ctx: SettleContext): string[] {
  const { state } = ctx;
  const earned: string[] = [];
  // At a shared table each player earns off their OWN hands and net —
  // the guest's blackjack must not unlock the host's trophy.
  const scoped = ctx.owner !== undefined;
  const roundNet = scoped ? netResultForOwner(state, ctx.owner!) : netResult(state);
  const wonRound = roundNet > 0;
  const hands = scoped
    ? state.hands.filter((h) => (h.owner ?? 0) === ctx.owner)
    : state.hands;

  if (ctx.roundsPlayed >= 1) earned.push("first-hand");
  if (ctx.roundsPlayed >= 100) earned.push("grinder-100");
  if (ctx.roundsPlayed >= 1000) earned.push("grinder-1000");

  if (hands.some((h) => h.outcome === "blackjack" || h.outcome === "even-money")) {
    earned.push("natural");
    if (state.promo === "happy-hour" && hands.some((h) => h.outcome === "blackjack")) {
      earned.push("golden-hour");
    }
  }

  if (hands.some((h) => h.doubled && WON(h.outcome))) earned.push("double-win");

  const splitHands = hands.filter((h) => h.fromSplit);
  if (splitHands.length >= 2 && splitHands.every((h) => WON(h.outcome))) {
    earned.push("split-sweep");
  }

  if (ctx.winStreak >= 5) earned.push("hot-streak-5");
  if (ctx.winStreak >= 10) earned.push("hot-streak-10");

  if (wonRound && ctx.chipsBeforePayout < 1000) earned.push("comeback-kid");
  if (wonRound && ctx.chipsBeforePayout === 0) earned.push("all-in-win");

  if (ctx.chipsAfter >= 100_000) earned.push("high-roller-100k");
  if (ctx.chipsAfter >= 1_000_000) earned.push("millionaire");

  const sideWin = hands.some(
    (h) =>
      (h.pp?.payout ?? 0) > 0 ||
      (h.tp?.payout ?? 0) > 0 ||
      (h.ll?.payout ?? 0) > 0 ||
      (h.mtd?.payout ?? 0) > 0
  );
  if (sideWin || (state.bustPayout ?? 0) > 0 || ctx.jackpotWon > 0) {
    earned.push("side-show");
  }
  if (hands.some((h) => (h.pp?.payout ?? 0) > 0 && h.pp?.label === "perfect pair")) {
    earned.push("perfect-pair");
  }
  if (hands.some((h) => (h.tp?.payout ?? 0) > 0 && h.tp?.label === "suited trips")) {
    earned.push("suited-trips");
  }
  if (ctx.jackpotWon > 0) earned.push("queens-crown");
  if ((state.bustPayout ?? 0) > 0) earned.push("bust-prophet");

  return earned;
}

/** Trainer-side checks — run whenever a blind decision is graded. */
export function earnedFromTrainer(stat: {
  right: number;
  wrong: number;
  best: number;
}): string[] {
  const earned: string[] = [];
  const volume = stat.right + stat.wrong;
  if (stat.best >= 25) earned.push("book-smart-25");
  if (volume >= 100 && stat.right / volume >= 0.9) earned.push("by-the-book");
  return earned;
}

/**
 * Win-streak transition: wins extend, losses reset, pushes carry.
 * `roundNet` is the MAIN-GAME net (side bets ride their own luck).
 */
export function nextWinStreak(current: number, roundNet: number): number {
  if (roundNet > 0) return current + 1;
  if (roundNet < 0) return 0;
  return current;
}
