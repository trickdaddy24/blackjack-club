import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clientView,
  IllegalActionError,
  placeBustBet,
} from "@/lib/blackjack/engine";
import { getActiveRound, MAX_BET, parseRoundState, roundStatus } from "@/lib/game";
import { withHint } from "@/lib/blackjack/strategy";

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
    amount > MAX_BET
  ) {
    return NextResponse.json(
      { error: `Bust bet must be a whole number between 1 and ${MAX_BET}` },
      { status: 400 }
    );
  }

  const round = await getActiveRound(userId);
  if (!round) {
    return NextResponse.json({ error: "No round in progress" }, { status: 404 });
  }

  const state = parseRoundState(round.stateJson);

  let result;
  try {
    result = placeBustBet(state, amount);
  } catch (err) {
    if (err instanceof IllegalActionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const { state: next, debit } = result;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chips: true },
  });
  if (!user || user.chips < debit) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { chips: { decrement: debit } },
      select: { chips: true },
    }),
    prisma.round.update({
      where: { id: round.id },
      data: {
        status: roundStatus(next),
        stateJson: JSON.stringify(next),
      },
    }),
  ]);

  return NextResponse.json({
    chips: updated.chips,
    round: withHint(next, clientView(next)),
  });
}
