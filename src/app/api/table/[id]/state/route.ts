import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTableView, enforceTurnDeadline, seatOf, TableError } from "@/lib/table";

/** GET: the poll endpoint. Also the lazy enforcer of the 30s turn clock. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let table = await prisma.table.findUnique({ where: { id } });
  if (!table || seatOf(table, session.user.id) === null) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    const enforced = await enforceTurnDeadline(table);
    table = enforced.table;
  } catch (err) {
    // A racing poll already stood the hand — just re-read
    if (err instanceof TableError) {
      table = (await prisma.table.findUnique({ where: { id } }))!;
    } else {
      throw err;
    }
  }

  return NextResponse.json({ table: await buildTableView(table, session.user.id) });
}
