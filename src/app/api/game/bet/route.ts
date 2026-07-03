import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  clientView,
  MAX_BOTS,
  MAX_SEATS,
  netResult,
  startRound,
  type Variant,
} from "@/lib/blackjack/engine";
import {
  getActiveRound,
  getPreviousCarry,
  MAX_BET,
  MAX_SIDE_BET,
  roundStatus,
} from "@/lib/game";
import { withHint } from "@/lib/blackjack/strategy";
import { currentTableMinimum } from "@/lib/tableMinimum";

const VARIANTS: Variant[] = ["classic", "spanish21"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let bet: unknown;
  let hands: unknown;
  let variant: unknown;
  let bots: unknown;
  let perfectPairs: unknown;
  try {
    ({ bet, hands, variant, bots, perfectPairs } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tableMin = currentTableMinimum();
  if (typeof bet !== "number" || !Number.isInteger(bet) || bet < tableMin.min || bet > MAX_BET) {
    return NextResponse.json(
      {
        error: `Table minimum is ${tableMin.min} right now (${tableMin.label}) — bet must be a whole number between ${tableMin.min} and ${MAX_BET}`,
      },
      { status: 400 }
    );
  }

  const pp = perfectPairs === undefined ? 0 : perfectPairs;
  if (
    typeof pp !== "number" ||
    !Number.isInteger(pp) ||
    pp < 0 ||
    pp > MAX_SIDE_BET
  ) {
    return NextResponse.json(
      { error: `Perfect Pairs bet must be 0 to ${MAX_SIDE_BET}` },
      { status: 400 }
    );
  }

  const seats = hands === undefined ? 1 : hands;
  if (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    return NextResponse.json(
      { error: `You can play 1 to ${MAX_SEATS} hands` },
      { status: 400 }
    );
  }

  const tableVariant = variant === undefined ? "classic" : variant;
  if (typeof tableVariant !== "string" || !VARIANTS.includes(tableVariant as Variant)) {
    return NextResponse.json({ error: "Unknown game variant" }, { status: 400 });
  }

  const botCount = bots === undefined ? 0 : bots;
  if (
    typeof botCount !== "number" ||
    !Number.isInteger(botCount) ||
    botCount < 0 ||
    botCount > MAX_BOTS
  ) {
    return NextResponse.json(
      { error: `You can seat 0 to ${MAX_BOTS} bots` },
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
  if (user.chips < (bet + pp) * seats) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const carry = await getPreviousCarry(userId);
  const { state, debit, shuffled, sideBetPayout } = startRound(bet, {
    previousShoe: carry?.shoe ?? null,
    previousVariant: carry?.variant,
    previousCount: carry?.runningCount,
    seats,
    variant: tableVariant as Variant,
    bots: botCount,
    perfectPairs: pp,
  });
  const settled = state.phase === "settled";
  // Side-bet winnings are paid on the spot, in the same transaction as the deal
  const chipDelta = -debit + (sideBetPayout ?? 0) + (settled ? state.payoutTotal : 0);

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

  return NextResponse.json({
    chips: updated.chips,
    round: withHint(state, clientView(state)),
    shuffled: shuffled === true,
  });
}
