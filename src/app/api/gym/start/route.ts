import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createShoe } from "@/lib/blackjack/engine";
import { drillAnswer, gymLevel } from "@/lib/gym";

/** POST {level}: issue a drill — a fresh 6-deck shoe sample + stored truth. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let level: unknown;
  try {
    ({ level } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const spec = typeof level === "string" ? gymLevel(level) : undefined;
  if (!spec) return NextResponse.json({ error: "Unknown level" }, { status: 400 });

  const cards = createShoe().slice(0, spec.cards);
  const drill = await prisma.gymDrill.create({
    data: {
      userId: session.user.id,
      level: spec.id,
      speedMs: spec.speedMs,
      count: spec.cards,
      cardsJson: JSON.stringify(cards),
      answer: drillAnswer(cards),
    },
  });

  return NextResponse.json({
    drillId: drill.id,
    cards,
    speedMs: spec.speedMs,
    level: spec.id,
  });
}
