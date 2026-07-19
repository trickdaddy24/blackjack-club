import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/admin";
import { LL_JACKPOT_NAME, LL_JACKPOT_SEED } from "@/lib/game";

const MAX_JACKPOT = 100_000_000;

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let amount: unknown, reason: unknown;
  try {
    ({ amount, reason } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 || amount > MAX_JACKPOT) {
    return NextResponse.json(
      { error: `Amount must be a non-negative integer up to ${MAX_JACKPOT.toLocaleString()}` },
      { status: 400 }
    );
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  }

  const before = await prisma.jackpot.upsert({
    where: { name: LL_JACKPOT_NAME },
    create: { name: LL_JACKPOT_NAME, amount: LL_JACKPOT_SEED },
    update: {},
    select: { amount: true },
  });
  const after = await prisma.jackpot.update({
    where: { name: LL_JACKPOT_NAME },
    data: { amount },
    select: { amount: true },
  });
  await logAdminAction(adminId, "jackpot-set", null, {
    reason: reason.trim(),
    before: before.amount,
    after: after.amount,
  });

  return NextResponse.json({ amount: after.amount });
}
