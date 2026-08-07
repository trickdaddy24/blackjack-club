import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSpadesTableView, placeSpadesBid, SpadesTableError } from "@/lib/spades-table";
import type { Bid } from "@/spades/engine/types";

/** POST {tricks, blind}: turn-locked bid on the live hand. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const table = await prisma.spadesTable.findUnique({ where: { id } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { tricks, blind } = (body ?? {}) as { tricks?: unknown; blind?: unknown };
  if (typeof tricks !== "number" || !Number.isInteger(tricks) || tricks < 0 || tricks > 13) {
    return NextResponse.json({ error: "tricks must be a whole number 0-13" }, { status: 400 });
  }
  const bid: Bid = { tricks, blind: tricks === 0 && blind === true };

  try {
    const fresh = await placeSpadesBid(table, session.user.id, bid);
    return NextResponse.json({ table: await buildSpadesTableView(fresh, session.user.id) });
  } catch (err) {
    if (err instanceof SpadesTableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
