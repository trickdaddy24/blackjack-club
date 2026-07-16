import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { MAX_BET } from "@/lib/game";

// Admin chip adjustment. Touches User.chips ONLY — never Round rows, so the
// Today/Week leaderboards (which sum rounds) can't read a top-up as winnings.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  // 404, not 403 — don't advertise the route to non-admins
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  let delta: unknown, reason: unknown;
  try {
    ({ delta, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    typeof delta !== "number" ||
    !Number.isInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > MAX_BET
  ) {
    return NextResponse.json(
      { error: `Delta must be a non-zero integer within ±${MAX_BET.toLocaleString()}` },
      { status: 400 }
    );
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { chips: true, name: true },
  });
  if (!target) return NextResponse.json({ error: "No such player" }, { status: 404 });
  if (target.chips + delta < 0) {
    return NextResponse.json(
      { error: `That would take ${target.name ?? "the player"} below 0 chips` },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { chips: { increment: delta } },
    select: { chips: true },
  });
  await logAdminAction(adminId, "chips-adjust", id, {
    delta,
    reason: reason.trim(),
    before: target.chips,
    after: updated.chips,
  });

  return NextResponse.json({ chips: updated.chips });
}
