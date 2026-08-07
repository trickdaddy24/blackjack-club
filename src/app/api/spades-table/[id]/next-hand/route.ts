import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSpadesTableView, dealNextSpadesHand, SpadesTableError } from "@/lib/spades-table";

/** POST: continue past a hand-result screen — either partner may trigger
 *  it, mirroring the single-player "Deal next hand" button. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const table = await prisma.spadesTable.findUnique({ where: { id } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  try {
    const fresh = await dealNextSpadesHand(table, session.user.id);
    return NextResponse.json({ table: await buildSpadesTableView(fresh, session.user.id) });
  } catch (err) {
    if (err instanceof SpadesTableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
