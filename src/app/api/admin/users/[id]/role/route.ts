import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";

// Ban / unban. Promotion to admin is deliberately NOT possible from the UI —
// that stays in scripts/promote-admin.js (console access required).
const SETTABLE_ROLES = ["user", "banned"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  let role: unknown, reason: unknown;
  try {
    ({ role, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof role !== "string" || !SETTABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Role must be user or banned" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }
  if (id === adminId) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!target) return NextResponse.json({ error: "No such player" }, { status: 404 });
  if (target.role === "admin") {
    return NextResponse.json({ error: "Admins can't be banned from the UI" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: { role } });
  await logAdminAction(adminId, "role-set", id, {
    reason: reason.trim(),
    before: target.role,
    after: role,
  });

  return NextResponse.json({ role });
}
