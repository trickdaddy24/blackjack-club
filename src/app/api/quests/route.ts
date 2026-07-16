import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vegasDayKey } from "@/lib/leaderboard";
import { dailyQuests } from "@/lib/quests";

/** GET: today's three quests with my progress, plus my login streak. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const day = vegasDayKey();
  const defs = dailyQuests(day);

  const [rows, user] = await Promise.all([
    prisma.questProgress.findMany({
      where: { userId, day, slug: { in: defs.map((d) => d.slug) } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { loginStreak: true, chips: true },
    }),
  ]);
  const byslug = new Map(rows.map((r) => [r.slug, r]));

  return NextResponse.json({
    day,
    loginStreak: user?.loginStreak ?? 0,
    chips: user?.chips ?? 0,
    quests: defs.map((d) => ({
      slug: d.slug,
      name: d.name,
      emoji: d.emoji,
      description: d.description,
      target: d.target,
      reward: d.reward,
      progress: Math.min(byslug.get(d.slug)?.progress ?? 0, d.target),
      done: byslug.get(d.slug)?.done ?? false,
    })),
  });
}
