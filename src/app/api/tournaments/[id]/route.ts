import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getLobbyView, TournamentError } from "@/lib/tournament-io";

/** GET: the full lobby view (leaderboard, my entry/hand, deadlines). Lazily
 *  settles/cancels this lobby first if its window has passed. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const view = await getLobbyView(id, session.user.id);
    return NextResponse.json({ lobby: view });
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
