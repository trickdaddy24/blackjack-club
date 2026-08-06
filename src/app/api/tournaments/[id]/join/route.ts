import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLobbyView, joinLobby, TournamentError } from "@/lib/tournament-io";

/** POST: join an open lobby, paying the buy-in. Auto-starts it at the max. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await joinLobby(id, session.user.id);
    const lobby = await getLobbyView(id, session.user.id);
    return NextResponse.json({ lobby });
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
