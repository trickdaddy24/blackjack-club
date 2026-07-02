import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientView, netResult, startRound } from "@/lib/blackjack/engine";
import {
  getActiveRound,
  getPreviousShoe,
  MAX_BET,
  MIN_BET,
  roundStatus,
} from "@/lib/game";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let bet: unknown;
  try {
    ({ bet } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof bet !== "number" || !Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) {
    return NextResponse.json(
      { error: `Bet must be a whole number between ${MIN_BET} and ${MAX_BET}` },
      { status: 400 }
    );
  }

  const existing = await getActiveRound(userId);
  if (existing) {
    return NextResponse.json(
      { error: "You already have a round in progress" },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.chips < bet) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const previousShoe = await getPreviousShoe(userId);
  const { state, debit } = startRound(bet, previousShoe);
  const settled = state.phase === "settled";
  const chipDelta = -debit + (settled ? state.payoutTotal : 0);

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: chipDelta } },
      select: { chips: true },
    }),
    prisma.round.create({
      data: {
        userId,
        status: roundStatus(state),
        bet,
        stateJson: JSON.stringify(state),
        netResult: settled ? netResult(state) : 0,
        settledAt: settled ? new Date() : null,
      },
    }),
  ]);

  return NextResponse.json({ chips: updated.chips, round: clientView(state) });
}
