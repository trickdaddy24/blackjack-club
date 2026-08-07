import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMemberSpadesTable, joinSpadesTable, SpadesTableError } from "@/lib/spades-table";

/**
 * POST {inviteId}: take the offered seat (seat 2) and immediately deal the
 * first hand — accepting a Spades invite auto-starts the table (see
 * lib/spades-table.ts's joinSpadesTable), unlike the blackjack Duo table
 * where the round starts only once both wagers are placed.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let inviteId: unknown;
  try {
    ({ inviteId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof inviteId !== "string") {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  const invite = await prisma.spadesInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.toId !== userId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json({ error: `This invite was ${invite.status}` }, { status: 410 });
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.spadesInvite.update({ where: { id: invite.id }, data: { status: "expired" } });
    return NextResponse.json({ error: "This invite expired — ask for a fresh one" }, { status: 410 });
  }

  // Can't sit at two Spades tables at once.
  const mine = await getMemberSpadesTable(userId);
  if (mine && mine.id !== invite.spadesTableId) {
    return NextResponse.json({ error: "Leave your current Spades table first" }, { status: 409 });
  }

  try {
    await joinSpadesTable(invite.spadesTableId, userId);
  } catch (err) {
    if (err instanceof SpadesTableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  await prisma.spadesInvite.update({ where: { id: invite.id }, data: { status: "accepted" } });

  return NextResponse.json({ tableId: invite.spadesTableId });
}
