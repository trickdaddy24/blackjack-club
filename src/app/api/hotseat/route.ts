import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHotSeatState, maybeTriggerHotSeat } from "@/lib/hotseat-io";

/** Polled fleet-wide (any page, not just /play) so the clock advances and
 *  every client hears about a drop even if they're on the leaderboard. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await maybeTriggerHotSeat();
  return NextResponse.json(await getHotSeatState());
}
