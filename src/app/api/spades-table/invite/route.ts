import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMemberSpadesTable, seatOfSpades } from "@/lib/spades-table";
import { sendInviteEmail } from "@/lib/email";

export const SPADES_INVITE_MINUTES = 5;

/**
 * POST {email}: host invites a member to partner up for Spades. Members
 * only; a new invite supersedes any pending one for the table — same
 * 5-minute-window, supersede-on-reinvite spec as the blackjack Duo invite
 * (src/app/api/table/invite/route.ts).
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

  const table = await getMemberSpadesTable(userId);
  if (!table || seatOfSpades(table, userId) !== 0) {
    return NextResponse.json({ error: "Open a Spades table first" }, { status: 409 });
  }
  if (table.guestId) {
    return NextResponse.json(
      { error: "Your table already has a partner — kick them first" },
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

  const invite = await prisma.$transaction(async (tx) => {
    await tx.spadesInvite.updateMany({
      where: { spadesTableId: table.id, status: "pending" },
      data: { status: "superseded" },
    });
    return tx.spadesInvite.create({
      data: {
        spadesTableId: table.id,
        fromId: userId,
        toId: target.id,
        expiresAt: new Date(Date.now() + SPADES_INVITE_MINUTES * 60 * 1000),
      },
    });
  });

  const base = process.env.AUTH_URL ?? "http://localhost:7600";
  const emailSent = await sendInviteEmail({
    to: target.email,
    fromName: session.user.name ?? "A club member",
    joinUrl: `${base}/spades-table/join/${invite.id}`,
    expiresMinutes: SPADES_INVITE_MINUTES,
    gameLabel: "Spades",
  });

  return NextResponse.json({
    inviteId: invite.id,
    to: target.name ?? target.email,
    expiresAt: invite.expiresAt,
    emailSent,
  });
}
