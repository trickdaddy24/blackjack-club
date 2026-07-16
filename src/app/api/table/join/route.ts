import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMemberTable } from "@/lib/table";

/** POST {inviteId}: take the offered seat (invite must still be live). */
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

  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.toId !== userId) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: `This invite was ${invite.status}` },
      { status: 410 }
    );
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.invite.update({ where: { id: invite.id }, data: { status: "expired" } });
    return NextResponse.json(
      { error: "This invite expired — ask for a fresh one" },
      { status: 410 }
    );
  }

  // Can't sit at two tables at once
  const mine = await getMemberTable(userId);
  if (mine && mine.id !== invite.tableId) {
    return NextResponse.json(
      { error: "Leave your current table first" },
      { status: 409 }
    );
  }

  // Seat the guest — guarded so a canceled/filled table can't be joined
  const seated = await prisma.table.updateMany({
    where: { id: invite.tableId, status: "open", guestId: null },
    data: { guestId: userId, status: "active" },
  });
  if (seated.count === 0) {
    return NextResponse.json(
      { error: "That table is no longer open" },
      { status: 410 }
    );
  }
  await prisma.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });

  return NextResponse.json({ tableId: invite.tableId });
}
