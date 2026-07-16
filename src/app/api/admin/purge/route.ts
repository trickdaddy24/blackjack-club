import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";

// Bulk-purge bot chaff: role "user", ZERO rounds ever, older than N days.
// Cascades wipe their (empty) relations. Admins and anyone who has played a
// single hand are untouchable here.
export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let days: unknown, reason: unknown;
  try {
    ({ days, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1) {
    return NextResponse.json({ error: "days must be a positive integer" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = {
    role: "user",
    createdAt: { lt: cutoff },
    rounds: { none: {} },
  } as const;

  const victims = await prisma.user.findMany({
    where,
    select: { id: true, email: true },
  });
  if (victims.length > 0) {
    // Re-assert the guard conditions in the delete itself, so anyone who
    // played their first hand between the two queries survives.
    await prisma.user.deleteMany({
      where: { id: { in: victims.map((v) => v.id) }, ...where },
    });
  }
  await logAdminAction(adminId, "purge", null, {
    days,
    reason: reason.trim(),
    deleted: victims.length,
    emails: victims.slice(0, 50).map((v) => v.email),
  });

  return NextResponse.json({ deleted: victims.length });
}
