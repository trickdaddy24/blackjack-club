import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { backOutOfLobby, TournamentError } from "@/lib/tournament-io";

/** POST: voluntary pre-start exit — full refund, seat released. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await backOutOfLobby(id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TournamentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
