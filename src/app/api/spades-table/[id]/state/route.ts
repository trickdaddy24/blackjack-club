import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildSpadesTableView,
  enforceSpadesTurnDeadline,
  seatOfSpades,
  SpadesTableError,
} from "@/lib/spades-table";

/** GET: the poll endpoint (POLL_MS = 1500 client-side, same as the
 *  blackjack Duo table). Also the lazy enforcer of the 30s turn clock. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let table = await prisma.spadesTable.findUnique({ where: { id } });
  if (!table || seatOfSpades(table, session.user.id) === null) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    table = await enforceSpadesTurnDeadline(table);
  } catch (err) {
    // A racing poll already forced the move — just re-read.
    if (err instanceof SpadesTableError) {
      table = (await prisma.spadesTable.findUnique({ where: { id } }))!;
    } else {
      throw err;
    }
  }

  return NextResponse.json({ table: await buildSpadesTableView(table, session.user.id) });
}
