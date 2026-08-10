import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vegasDayKey } from "@/lib/leaderboard";
import { alreadyClaimed, claimField } from "@/lib/claims";
import { WHEEL_SEGMENTS, rollSegmentIndex, segmentAt } from "@/lib/chip-wheel";
import { creditData, readBalance, WALLET_SELECT } from "@/lib/wallet";
import type { Room } from "@/lib/blackjack/engine";

const ROOMS: Room[] = ["classic", "trilux"];

/** Which table this request is for — the two tables have separate allowances. */
function getRoom(req: Request): Room {
  return new URL(req.url).searchParams.get("room") === "trilux" ? "trilux" : "classic";
}

/** GET: the wheel's segments (always) + whether today's spin is still available. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastChipWheelSpin: true, triluxLastChipWheelSpin: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available =
    !alreadyClaimed(user[claimField(getRoom(req), "wheel")], "wheel");

  return NextResponse.json({
    available,
    segments: WHEEL_SEGMENTS.map((s) => ({ value: s.value, jackpot: s.jackpot, tier: s.tier })),
  });
}

/** POST: spin — one per Vegas day. Rolls server-side, credits immediately. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Spin lands in the wallet of the table you spun from.
  let room: Room = "classic";
  try {
    const body = await req.json();
    if (typeof body?.room === "string" && ROOMS.includes(body.room as Room)) {
      room = body.room as Room;
    }
  } catch {
    /* no body — credit the main table */
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastChipWheelSpin: true, triluxLastChipWheelSpin: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const field = claimField(room, "wheel");
  if (alreadyClaimed(user[field], "wheel", now)) {
    return NextResponse.json(
      { error: "Already spun the wheel today — come back tomorrow" },
      { status: 429 }
    );
  }

  // CAS on lastChipWheelSpin guards a double-tap from two racing requests.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, [field]: user[field] },
    data: { [field]: now },
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
    data: creditData(room, segment.value),
    select: WALLET_SELECT,
  });

  return NextResponse.json({
    chips: readBalance(updated, room),
    mainChips: updated.chips,
    triluxChips: updated.triluxChips,
    granted: segment.value,
    jackpot: segment.jackpot,
    tier: segment.tier,
    segmentIndex: index,
  });
}
