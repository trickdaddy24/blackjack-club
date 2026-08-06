import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLobbyView, manualStartLobby, TournamentError } from "@/lib/tournament-io";

/** POST: manual start by the creator, once the 3-entrant floor is met. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await manualStartLobby(id, session.user.id);
    const lobby = await getLobbyView(id, session.user.id);
    return NextResponse.json({ lobby });
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
