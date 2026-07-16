import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** GET: my pending table invites (expiry enforced lazily on read). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sweep anything past its window before reporting
  await prisma.invite.updateMany({
    where: { toId: session.user.id, status: "pending", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });

  const invites = await prisma.invite.findMany({
    where: { toId: session.user.id, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const fromIds = [...new Set(invites.map((i) => i.fromId))];
  const froms = await prisma.user.findMany({
    where: { id: { in: fromIds } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(froms.map((u) => [u.id, u.name ?? "A club member"]));

  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      from: nameOf.get(i.fromId) ?? "A club member",
      expiresAt: i.expiresAt.toISOString(),
    })),
  });
}
