import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { validatePasswordComplexity } from "@/lib/password";

// Manual password set for players who can't reach their registered email
// (dead inbox, typo'd on signup, etc.) — bypasses the reset-link flow
// entirely. The plaintext never touches the audit log, only the reason.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  // 404, not 403 — don't advertise the route to non-admins
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  let password: unknown, reason: unknown;
  try {
    ({ password, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof password !== "string") {
    return NextResponse.json({ error: "A password is required" }, { status: 400 });
  }
  const complexityError = validatePasswordComplexity(password);
  if (complexityError) {
    return NextResponse.json({ error: complexityError }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "No such player" }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Admin passwords can't be changed from the console" },
      { status: 400 }
    );
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { password: hashed } }),
    // Any outstanding self-serve reset link becomes stale the moment the
    // console sets a password directly — burn it so it can't be replayed.
    prisma.passwordResetToken.updateMany({
      where: { userId: id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  await logAdminAction(adminId, "password-reset", id, { reason: reason.trim() });

  return NextResponse.json({ success: true });
}
