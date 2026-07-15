import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  applyAction,
  clientView,
  IllegalActionError,
  netResult,
  type PlayerAction,
} from "@/lib/blackjack/engine";
import {
  getActiveRound,
  parseRoundState,
  roundStatus,
  settleLuckyLadiesPot,
} from "@/lib/game";
import { withHint } from "@/lib/blackjack/strategy";

const ACTIONS: PlayerAction[] = [
  "hit",
  "stand",
  "double",
  "split",
  "surrender",
  "insurance-yes",
  "insurance-no",
  "even-money-yes",
  "even-money-no",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof action !== "string" || !ACTIONS.includes(action as PlayerAction)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const round = await getActiveRound(userId);
  if (!round) {
    return NextResponse.json({ error: "No round in progress" }, { status: 404 });
  }

  const state = parseRoundState(round.stateJson);

  let result;
  try {
    result = applyAction(state, action as PlayerAction);
  } catch (err) {
    if (err instanceof IllegalActionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const { state: next, debit } = result;

  if (debit > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { chips: true },
    });
    if (!user || user.chips < debit) {
      return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
    }
  }

  const settled = next.phase === "settled";

  // Lucky Ladies progressive can land here too: the round was dealt with a
  // QoH pair, the dealer showed an ace, and the post-insurance peek reveals
  // blackjack. (Stakes were already fed to the pot at the deal.)
  let jackpotWon = 0;
  if (settled && next.hands.some((h) => h.llJackpot)) {
    ({ won: jackpotWon } = await settleLuckyLadiesPot(0, true));
  }

  const chipDelta = -debit + jackpotWon + (settled ? next.payoutTotal : 0);

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { chips: { increment: chipDelta } },
      select: { chips: true },
    }),
    prisma.round.update({
      where: { id: round.id },
      data: {
        status: roundStatus(next),
        stateJson: JSON.stringify(next),
        netResult: settled ? netResult(next) : 0,
        settledAt: settled ? new Date() : null,
      },
    }),
  ]);

  return NextResponse.json({
    chips: updated.chips,
    round: withHint(next, clientView(next)),
    ...(jackpotWon > 0 ? { jackpotWon } : {}),
  });
}
