import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { achievementDef } from "@/lib/achievements";

// Grant or revoke a trophy (testing, goodwill, cleanup). grant: true|false.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  let slug: unknown, grant: unknown, reason: unknown;
  try {
    ({ slug, grant, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof slug !== "string" || !achievementDef(slug)) {
    return NextResponse.json({ error: "Unknown achievement slug" }, { status: 400 });
  }
  if (typeof grant !== "boolean") {
    return NextResponse.json({ error: "grant must be true or false" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "No such player" }, { status: 404 });

  if (grant) {
    await prisma.achievement.upsert({
      where: { userId_slug: { userId: id, slug } },
      create: { userId: id, slug },
      update: {},
    });
  } else {
    await prisma.achievement.deleteMany({ where: { userId: id, slug } });
  }
  await logAdminAction(adminId, grant ? "achievement-grant" : "achievement-revoke", id, {
    slug,
    reason: reason.trim(),
  });

  return NextResponse.json({ slug, granted: grant });
}
