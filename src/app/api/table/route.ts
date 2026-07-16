import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTableView, getMemberTable, TableError } from "@/lib/table";

/** GET: the caller's current table (if any), as their view. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const table = await getMemberTable(session.user.id);
  if (!table) return NextResponse.json({ table: null });
  return NextResponse.json({ table: await buildTableView(table, session.user.id) });
}

/** POST: open a table (host). One non-ended table per player. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await getMemberTable(session.user.id);
  if (existing) {
    return NextResponse.json({ tableId: existing.id, existing: true });
  }
  try {
    const table = await prisma.table.create({
      data: { hostId: session.user.id },
    });
    return NextResponse.json({ tableId: table.id, existing: false });
  } catch (err) {
    if (err instanceof TableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
