// Awarding I/O for achievements — kept out of achievements.ts so the pure
// catalog/checks stay importable in vitest without dragging in Prisma.

import { prisma } from "@/lib/prisma";
import { achievementDef, type AchievementDef } from "@/lib/achievements";

/**
 * Persist any not-yet-unlocked slugs and return the defs of the NEW ones
 * (what the client should toast). Non-critical path: a concurrent settle can
 * race the insert — the composite PK makes the duplicate harmless, so P2002
 * is swallowed and the racing request simply doesn't re-toast.
 */
export async function awardAchievements(
  userId: string,
  earned: string[]
): Promise<AchievementDef[]> {
  if (earned.length === 0) return [];
  const slugs = [...new Set(earned)].filter((s) => achievementDef(s));
  const existing = await prisma.achievement.findMany({
    where: { userId, slug: { in: slugs } },
    select: { slug: true },
  });
  const have = new Set(existing.map((e) => e.slug));
  const fresh = slugs.filter((s) => !have.has(s));
  if (fresh.length === 0) return [];
  try {
    await prisma.achievement.createMany({
      data: fresh.map((slug) => ({ userId, slug })),
    });
  } catch {
    // Duplicate from a concurrent settle — the unlock exists, skip the toast.
    return [];
  }
  return fresh.map((s) => achievementDef(s)!);
}
