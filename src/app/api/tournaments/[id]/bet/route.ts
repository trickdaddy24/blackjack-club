import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { placeTournamentBet, TournamentError } from "@/lib/tournament-io";

/** POST {bet}: deal a fresh tournament hand against the isolated stack. No side bets. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let bet: unknown;
  let perfectPairs: unknown;
  let twentyOnePlusThree: unknown;
  let luckyLadies: unknown;
  try {
    ({ bet, perfectPairs, twentyOnePlusThree, luckyLadies } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await placeTournamentBet(id, session.user.id, {
      bet,
      perfectPairs,
      twentyOnePlusThree,
      luckyLadies,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
