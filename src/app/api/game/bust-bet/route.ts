import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clientView,
  IllegalActionError,
  placeBustBet,
} from "@/lib/blackjack/engine";
import { getActiveRound, MAX_BET, parseRoundState, roundStatus } from "@/lib/game";
import { creditData, readBalance, WALLET_SELECT } from "@/lib/wallet";
import { withHint } from "@/lib/blackjack/strategy";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let amount: unknown;
  let proBook: unknown;
  try {
    ({ amount, proBook } = await req.json());
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

  // Bust bet rides on the round's own table, so it draws from that wallet.
  const room = state.room ?? "classic";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: WALLET_SELECT,
  });
  if (!user || readBalance(user, room) < debit) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: creditData(room, -debit),
      select: WALLET_SELECT,
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
    chips: readBalance(updated, room),
    mainChips: updated.chips,
    triluxChips: updated.triluxChips,
    round: withHint(next, clientView(next), proBook === true),
  });
}
