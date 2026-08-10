// Daily-quest IO: progress rows + instant reward payout. Non-critical path —
// called AFTER the settle transaction, and a failure here never breaks a
// round (the round already settled; quests just don't advance).

import { prisma } from "@/lib/prisma";
import { creditData } from "@/lib/wallet";
import type { Room } from "@/lib/blackjack/engine";
import { vegasDayKey } from "@/lib/leaderboard";
import {
  CLEAN_SWEEP,
  CLEAN_SWEEP_SLUG,
  advanceQuest,
  dailyQuests,
  isCleanSweep,
  sweepStreak,
  type SettleEvent,
} from "@/lib/quests";

/**
 * Advance today's quests for one player after one settled round. Rewards pay
 * the moment a quest completes. Safe to fire-and-forget.
 */
export async function progressQuestsAtSettle(
  userId: string,
  ev: SettleEvent,
  now: Date = new Date(),
  // Quest rewards land in the wallet of the table that completed them. The
  // gym and Duo callers leave this at the default — neither is a Trilux table.
  room: Room = "classic"
): Promise<void> {
  const day = vegasDayKey(now);
  try {
    for (const def of dailyQuests(day)) {
      const row = await prisma.questProgress.findUnique({
        where: { userId_day_slug: { userId, day, slug: def.slug } },
      });
      if (row?.done) continue;
      const next = advanceQuest(def, row?.progress ?? 0, ev);
      if (next === (row?.progress ?? 0) && row) continue; // nothing changed
      const done = next >= def.target;
      await prisma.questProgress.upsert({
        where: { userId_day_slug: { userId, day, slug: def.slug } },
        create: { userId, day, slug: def.slug, progress: next, done },
        update: { progress: next, done },
      });
      if (done && !row?.done) {
        await prisma.user.update({
          where: { id: userId },
          data: creditData(room, def.reward),
        });
      }
    }
    await awardCleanSweep(userId, day, room);
  } catch (err) {
    console.error("quest progression failed:", (err as Error).message);
  }
}

/**
 * Pays the Clean Sweep bonus the first time all three of the day's quests are
 * done. The award is itself a QuestProgress row under a reserved slug, so
 * `create` on the composite primary key is what makes it idempotent — two
 * rounds settling concurrently can't both pay out, because the second insert
 * violates the key rather than reading a stale "not yet awarded".
 */
async function awardCleanSweep(
  userId: string,
  day: string,
  room: Room = "classic"
): Promise<void> {
  const defs = dailyQuests(day);
  const rows = await prisma.questProgress.findMany({
    where: { userId, day, done: true },
    select: { slug: true },
  });
  const doneSlugs = rows.map((r) => r.slug);
  if (doneSlugs.includes(CLEAN_SWEEP_SLUG)) return;   // already paid today
  if (!isCleanSweep(defs, doneSlugs)) return;

  try {
    await prisma.questProgress.create({
      data: { userId, day, slug: CLEAN_SWEEP_SLUG, progress: defs.length, done: true },
    });
  } catch {
    return;   // lost the race — the other round paid it
  }
  await prisma.user.update({
    where: { id: userId },
    data: creditData(room, CLEAN_SWEEP.reward),
  });
}

/** Consecutive days this player has swept, ending today. */
export async function getSweepStreak(userId: string, now: Date = new Date()): Promise<number> {
  const today = vegasDayKey(now);
  const rows = await prisma.questProgress.findMany({
    where: { userId, slug: CLEAN_SWEEP_SLUG, done: true },
    select: { day: true },
    orderBy: { day: "desc" },
    take: 400,
  });
  return sweepStreak(rows.map((r) => r.day), today);
}
