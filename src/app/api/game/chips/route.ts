import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveRound, parseRoundState } from "@/lib/game";
import { readBalance, WALLET_SELECT } from "@/lib/wallet";

/** Just the balance. Polled by the table HUD to reconcile out-of-band credits
 *  (hot seat, quests, VIP, champions, admin grants) without dragging the whole
 *  round state along — see lib/chip-events.ts. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: WALLET_SELECT,
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Report the wallet backing the round in progress, so the HUD reconcile
  // doesn't flicker to the main balance while sitting at Trilux. No live
  // round (between hands, or at the lobby) falls back to main.
  const clientRoom =
    new URL(req.url).searchParams.get("room") === "trilux" ? "trilux" : "classic";
  const round = await getActiveRound(session.user.id);
  const room = round ? (parseRoundState(round.stateJson).room ?? "classic") : clientRoom;
  return NextResponse.json({
    chips: readBalance(user, room),
    mainChips: user.chips,
    triluxChips: user.triluxChips,
  });
}
