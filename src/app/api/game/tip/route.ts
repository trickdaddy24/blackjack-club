import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TIP } from "@/lib/game";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let amount: unknown;
  try {
    ({ amount } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > MAX_TIP
  ) {
    return NextResponse.json(
      { error: `Tip must be a whole number between 1 and ${MAX_TIP}` },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.chips < amount) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      chips: { decrement: amount },
      dealerTips: { increment: amount },
    },
    select: { chips: true, dealerTips: true },
  });

  return NextResponse.json({ chips: updated.chips, dealerTips: updated.dealerTips });
}
