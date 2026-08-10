import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { vegasDayKey } from "@/lib/leaderboard";
import { PROPERTY_CATALOG, findProperty, rollPropertyAmount } from "@/lib/property-bonus";
import { creditData, readBalance, WALLET_SELECT } from "@/lib/wallet";
import type { Room } from "@/lib/blackjack/engine";

const ROOMS: Room[] = ["classic", "trilux"];

/** GET: today's property catalog + whether the pick is still available. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastPropertyPick: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available =
    !user.lastPropertyPick || vegasDayKey(user.lastPropertyPick) !== vegasDayKey();

  return NextResponse.json({
    available,
    properties: PROPERTY_CATALOG.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
    })),
  });
}

/** POST { propertyId }: claim today's pick — one per Vegas day. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const propertyId = body?.propertyId;
  const room: Room =
    typeof body?.room === "string" && ROOMS.includes(body.room as Room)
      ? (body.room as Room)
      : "classic";
  const def = typeof propertyId === "string" ? findProperty(propertyId) : undefined;
  if (!def) {
    return NextResponse.json({ error: "Unknown property" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastPropertyPick: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (user.lastPropertyPick && vegasDayKey(user.lastPropertyPick) === vegasDayKey(now)) {
    return NextResponse.json(
      { error: "Already picked a property today — come back tomorrow" },
      { status: 429 }
    );
  }

  // CAS on lastPropertyPick guards a double-claim from two racing taps.
  const claimed = await prisma.user.updateMany({
    where: { id: userId, lastPropertyPick: user.lastPropertyPick },
    data: { lastPropertyPick: now },
  });
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: "Already picked a property today — come back tomorrow" },
      { status: 429 }
    );
  }

  const { amount, bonusHit } = rollPropertyAmount(def);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: creditData(room, amount),
    select: WALLET_SELECT,
  });

  return NextResponse.json({
    chips: readBalance(updated, room),
    mainChips: updated.chips,
    triluxChips: updated.triluxChips,
    granted: amount,
    bonusHit,
    propertyId: def.id,
    propertyName: def.name,
    bonusLabel: bonusHit ? def.bonusLabel : null,
  });
}
