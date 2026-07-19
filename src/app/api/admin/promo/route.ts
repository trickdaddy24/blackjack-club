import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { PROMO_SCHEDULE } from "@/lib/promotions";

const MAX_MINUTES = 480;

// Force a promo on early, or clear an active override — a server-side flag
// with an expiry, not a code change (docs/ADMIN-CONSOLE.md). Never touches
// PROMO_SCHEDULE itself.
export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let promoId: unknown, minutes: unknown, reason: unknown;
  try {
    ({ promoId, minutes, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  // Clearing: promoId null cancels any running override immediately.
  if (promoId === null) {
    await prisma.promoOverride.upsert({
      where: { id: "global" },
      create: { id: "global", promoId: null, expiresAt: null },
      update: { promoId: null, expiresAt: null },
    });
    await logAdminAction(adminId, "promo-force", null, { reason: reason.trim(), cleared: true });
    return NextResponse.json({ promoId: null, expiresAt: null });
  }

  if (typeof promoId !== "string" || !PROMO_SCHEDULE.some((p) => p.id === promoId)) {
    return NextResponse.json({ error: "Unknown promo id" }, { status: 400 });
  }
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
    return NextResponse.json(
      { error: `Minutes must be an integer between 1 and ${MAX_MINUTES}` },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + minutes * 60_000);
  await prisma.promoOverride.upsert({
    where: { id: "global" },
    create: { id: "global", promoId, expiresAt },
    update: { promoId, expiresAt },
  });
  await logAdminAction(adminId, "promo-force", null, {
    reason: reason.trim(),
    promoId,
    minutes,
    expiresAt: expiresAt.toISOString(),
  });

  return NextResponse.json({ promoId, expiresAt: expiresAt.toISOString() });
}
