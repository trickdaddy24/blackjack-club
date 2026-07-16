import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMemberTable, seatOf } from "@/lib/table";
import { sendInviteEmail } from "@/lib/email";

export const INVITE_MINUTES = 5;

/**
 * POST {email}: host invites a member to their table. Members only; a new
 * invite supersedes any pending one for the table (Kendall's spec: 5-minute
 * window, canceled when the host picks someone else).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let email: unknown;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "An email address is required" }, { status: 400 });
  }

  const table = await getMemberTable(userId);
  if (!table || seatOf(table, userId) !== 0) {
    return NextResponse.json({ error: "Open a table first" }, { status: 409 });
  }
  if (table.guestId) {
    return NextResponse.json(
      { error: "Your table already has a guest — kick them first" },
      { status: 409 }
    );
  }

  const target = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (!target) {
    return NextResponse.json(
      { error: "No member with that email — invites are members-only (for now)" },
      { status: 404 }
    );
  }
  if (target.id === userId) {
    return NextResponse.json({ error: "You're already at your own table" }, { status: 400 });
  }
  if (target.role === "banned") {
    return NextResponse.json({ error: "That player can't be invited" }, { status: 400 });
  }

  // Supersede any pending invite for this table, then issue the new one
  const invite = await prisma.$transaction(async (tx) => {
    await tx.invite.updateMany({
      where: { tableId: table.id, status: "pending" },
      data: { status: "superseded" },
    });
    return tx.invite.create({
      data: {
        tableId: table.id,
        fromId: userId,
        toId: target.id,
        expiresAt: new Date(Date.now() + INVITE_MINUTES * 60 * 1000),
      },
    });
  });

  const base = process.env.AUTH_URL ?? "http://localhost:7600";
  const emailSent = await sendInviteEmail({
    to: target.email,
    fromName: session.user.name ?? "A club member",
    joinUrl: `${base}/table/join/${invite.id}`,
    expiresMinutes: INVITE_MINUTES,
  });

  return NextResponse.json({
    inviteId: invite.id,
    to: target.name ?? target.email,
    expiresAt: invite.expiresAt,
    emailSent,
  });
}
