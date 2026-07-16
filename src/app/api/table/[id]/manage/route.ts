import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { liveRound, seatOf } from "@/lib/table";

/**
 * POST {op}: table management per the locked design — "host controls
 * everything": host can kick the guest or end the table; the guest may
 * leave their seat (the table survives as the host's, back to open).
 * All ops wait for the live round to settle first.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  const seat = seatOf(table, session.user.id);
  if (seat === null) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  let op: unknown;
  try {
    ({ op } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (liveRound(table)) {
    return NextResponse.json(
      { error: "Finish the current hand first" },
      { status: 409 }
    );
  }

  if (op === "end") {
    if (seat !== 0) return NextResponse.json({ error: "Only the host can end the table" }, { status: 403 });
    await prisma.table.update({
      where: { id },
      data: { status: "ended", endedReason: "host-ended" },
    });
    return NextResponse.json({ ended: true });
  }

  if (op === "kick") {
    if (seat !== 0) return NextResponse.json({ error: "Only the host can kick" }, { status: 403 });
    if (!table.guestId) return NextResponse.json({ error: "No guest seated" }, { status: 409 });
    await prisma.table.update({
      where: { id },
      data: { guestId: null, status: "open", guestBet: 0, guestSideJson: null },
    });
    return NextResponse.json({ kicked: true });
  }

  if (op === "leave") {
    if (seat !== 1) return NextResponse.json({ error: "The host ends the table instead of leaving" }, { status: 403 });
    await prisma.table.update({
      where: { id },
      data: { guestId: null, status: "open", guestBet: 0, guestSideJson: null },
    });
    return NextResponse.json({ left: true });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
