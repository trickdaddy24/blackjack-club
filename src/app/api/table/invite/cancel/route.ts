import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** POST {inviteId}: host cancels a pending invite. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let inviteId: unknown;
  try {
    ({ inviteId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof inviteId !== "string") {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }
  const updated = await prisma.invite.updateMany({
    where: { id: inviteId, fromId: session.user.id, status: "pending" },
    data: { status: "canceled" },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "No pending invite to cancel" }, { status: 404 });
  }
  return NextResponse.json({ canceled: true });
}
