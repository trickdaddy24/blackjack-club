import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createLobby, listOpenLobbies, listMyLiveEntries } from "@/lib/tournament-io";
import { TournamentError } from "@/lib/tournament-io";

/** GET: open lobbies to join, plus tournaments I'm currently live in. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [lobbies, mine] = await Promise.all([
    listOpenLobbies(),
    listMyLiveEntries(session.user.id),
  ]);
  return NextResponse.json({ lobbies, mine });
}

/** POST: open a new lobby, paying the buy-in as the first entrant. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const lobby = await createLobby(session.user.id);
    return NextResponse.json({ lobbyId: lobby.id });
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
