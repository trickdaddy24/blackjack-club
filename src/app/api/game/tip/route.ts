import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MAX_TIP } from "@/lib/game";
import { creditData, readBalance, WALLET_SELECT } from "@/lib/wallet";
import type { Room } from "@/lib/blackjack/engine";

const ROOMS: Room[] = ["classic", "trilux"];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let amount: unknown;
  let room: unknown;
  try {
    ({ amount, room } = await req.json());
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

  // The tip comes out of the table you're sitting at. Client-supplied because
  // tipping happens AFTER the round settles, so there's no active round to read
  // the table from — and it's safe to trust here: a tip is a pure debit from
  // the player's own wallet, so "lying" only picks which of your own pockets
  // pays. Still validated so it can't be an arbitrary column name.
  const tipRoom: Room =
    typeof room === "string" && ROOMS.includes(room as Room) ? (room as Room) : "classic";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: WALLET_SELECT,
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (readBalance(user, tipRoom) < amount) {
    return NextResponse.json({ error: "Not enough chips" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...creditData(tipRoom, -amount),
      dealerTips: { increment: amount },
    },
    select: { ...WALLET_SELECT, dealerTips: true },
  });

  return NextResponse.json({
    chips: readBalance(updated, tipRoom),
    mainChips: updated.chips,
    triluxChips: updated.triluxChips,
    dealerTips: updated.dealerTips,
  });
}
