// Daily-quest IO: progress rows + instant reward payout. Non-critical path —
// called AFTER the settle transaction, and a failure here never breaks a
// round (the round already settled; quests just don't advance).

import { prisma } from "@/lib/prisma";
import { vegasDayKey } from "@/lib/leaderboard";
import { advanceQuest, dailyQuests, type SettleEvent } from "@/lib/quests";

/**
 * Advance today's quests for one player after one settled round. Rewards pay
 * the moment a quest completes. Safe to fire-and-forget.
 */
export async function progressQuestsAtSettle(
  userId: string,
  ev: SettleEvent,
  now: Date = new Date()
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
          data: { chips: { increment: def.reward } },
        });
      }
    }
  } catch (err) {
    console.error("quest progression failed:", (err as Error).message);
  }
}
