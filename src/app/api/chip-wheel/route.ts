import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vegasDayKey } from "@/lib/leaderboard";
import { WHEEL_SEGMENTS, rollSegmentIndex, segmentAt } from "@/lib/chip-wheel";

/** GET: the wheel's segments (always) + whether today's spin is still available. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastChipWheelSpin: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available =
    !user.lastChipWheelSpin || vegasDayKey(user.lastChipWheelSpin) !== vegasDayKey();

  return NextResponse.json({
    available,
    segments: WHEEL_SEGMENTS.map((s) => ({ value: s.value, jackpot: s.jackpot })),
  });
}

/** POST: spin — one per Vegas day. Rolls server-side, credits immediately. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastChipWheelSpin: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (user.lastChipWheelSpin && vegasDayKey(user.lastChipWheelSpin) === vegasDayKey(now)) {
    return NextResponse.json(
      { error: "Already spun the wheel today — come back tomorrow" },
      { status: 429 }
    );
  }

  // CAS on lastChipWheelSpin guards a double-tap from two racing requests.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, lastChipWheelSpin: user.lastChipWheelSpin },
    data: { lastChipWheelSpin: now },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "Already spun the wheel today — come back tomorrow" },
      { status: 429 }
    );
  }

  const index = rollSegmentIndex();
  const segment = segmentAt(index);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { chips: { increment: segment.value } },
    select: { chips: true },
  });

  return NextResponse.json({
    chips: updated.chips,
    granted: segment.value,
    jackpot: segment.jackpot,
    segmentIndex: index,
  });
}
