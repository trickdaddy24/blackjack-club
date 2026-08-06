import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { PlayerAction } from "@/lib/blackjack/engine";
import { playTournamentAction, TournamentError } from "@/lib/tournament-io";

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

/** POST {action}: act on the tournament hand in progress. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof action !== "string" || !ACTIONS.includes(action as PlayerAction)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const result = await playTournamentAction(id, session.user.id, action as PlayerAction);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
