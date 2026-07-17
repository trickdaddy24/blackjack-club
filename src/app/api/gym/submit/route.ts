import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ELITE_LEVELS } from "@/lib/gym";
import { GYM_EVENT } from "@/lib/quests";
import { progressQuestsAtSettle } from "@/lib/quests-io";
import { awardAchievements } from "@/lib/game-achievements";
import { vegasDayStart } from "@/lib/leaderboard";

/** First perfect drill each Vegas day pays a little sweat equity. */
const DAILY_PERFECT_REWARD = 250;

/** POST {drillId, answer}: grade the drill, pay/award, advance quests. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let drillId: unknown, answer: unknown;
  try {
    ({ drillId, answer } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof drillId !== "string" || typeof answer !== "number" || !Number.isInteger(answer)) {
    return NextResponse.json({ error: "drillId and an integer answer required" }, { status: 400 });
  }

  const drill = await prisma.gymDrill.findUnique({ where: { id: drillId } });
  if (!drill || drill.userId !== userId) {
    return NextResponse.json({ error: "Drill not found" }, { status: 404 });
  }
  if (drill.submitted !== null) {
    return NextResponse.json({ error: "Drill already graded" }, { status: 409 });
  }

  const correct = answer === drill.answer;
  // Guarded update — a double-submit race grades once
  const claimed = await prisma.gymDrill.updateMany({
    where: { id: drill.id, submitted: null },
    data: { submitted: answer, correct },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "Drill already graded" }, { status: 409 });
  }

  // First perfect of the Vegas day pays out
  let reward = 0;
  if (correct) {
    const earlierPerfect = await prisma.gymDrill.count({
      where: {
        userId,
        correct: true,
        createdAt: { gte: vegasDayStart() },
        id: { not: drill.id },
      },
    });
    if (earlierPerfect === 0) {
      reward = DAILY_PERFECT_REWARD;
      await prisma.user.update({
        where: { id: userId },
        data: { chips: { increment: reward } },
      });
    }
  }

  // Trophies + quest progress (non-critical)
  const earned: string[] = ["counting-rookie"];
  if (correct && ELITE_LEVELS.has(drill.level)) earned.push("counting-ace");
  const unlocked = await awardAchievements(userId, earned);
  await progressQuestsAtSettle(userId, GYM_EVENT);

  return NextResponse.json({
    correct,
    actual: drill.answer,
    submitted: answer,
    ...(reward > 0 ? { reward } : {}),
    ...(unlocked.length > 0 ? { unlocked } : {}),
  });
}
