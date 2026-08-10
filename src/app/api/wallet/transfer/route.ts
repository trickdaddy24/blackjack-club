import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRound } from "@/lib/game";
import { readBalance, WALLET_SELECT } from "@/lib/wallet";
import { checkTransfer, isTransferDirection } from "@/lib/transfer";

/**
 * POST {direction, amount} — move chips between the main and Trilux wallets.
 *
 * The only path by which the two bankrolls ever exchange money, so it is the
 * one place a bug here can duplicate or destroy chips. Both sides move inside
 * a single transaction, and the debit is expressed as a conditional
 * `updateMany` guarded on the source balance so two concurrent transfers
 * can't both pass the same affordability check and overdraw.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let direction: unknown;
  let amount: unknown;
  try {
    ({ direction, amount } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isTransferDirection(direction)) {
    return NextResponse.json({ error: "Unknown transfer direction" }, { status: 400 });
  }

  // No moving money mid-hand: a live round has already debited its wager, and
  // letting the bankroll shift underneath it invites accounting drift.
  const active = await getActiveRound(userId);
  if (active) {
    return NextResponse.json(
      { error: "Finish the hand in progress before moving chips" },
      { status: 409 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: WALLET_SELECT,
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const toTrilux = direction === "to-trilux";
  const sourceBalance = readBalance(user, toTrilux ? "classic" : "trilux");

  const check = checkTransfer(amount, sourceBalance);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const n = amount as number;

  const updated = await prisma.$transaction(async (tx) => {
    // Guarded debit: the `where` re-checks the balance at write time, so a
    // racing second transfer finds count === 0 instead of overdrawing.
    const debited = await tx.user.updateMany({
      where: toTrilux
        ? { id: userId, chips: { gte: n } }
        : { id: userId, triluxChips: { gte: n } },
      data: toTrilux
        ? { chips: { decrement: n }, triluxChips: { increment: n } }
        : { triluxChips: { decrement: n }, chips: { increment: n } },
    });
    if (debited.count === 0) return null;
    return tx.user.findUniqueOrThrow({ where: { id: userId }, select: WALLET_SELECT });
  });

  if (!updated) {
    return NextResponse.json({ error: "Not enough chips in that wallet" }, { status: 400 });
  }

  return NextResponse.json({
    mainChips: updated.chips,
    triluxChips: updated.triluxChips,
    moved: n,
    direction,
  });
}
