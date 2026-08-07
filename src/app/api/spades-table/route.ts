import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildSpadesTableView, getMemberSpadesTable, openSpadesTable } from "@/lib/spades-table";

/** GET: the caller's current Spades table (if any), as their view. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const table = await getMemberSpadesTable(session.user.id);
  if (!table) return NextResponse.json({ table: null });
  return NextResponse.json({ table: await buildSpadesTableView(table, session.user.id) });
}

/** POST: open a table (host = seat 0). One non-ended Spades table per player. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await getMemberSpadesTable(session.user.id);
  if (existing) {
    return NextResponse.json({ tableId: existing.id, existing: true });
  }
  const table = await openSpadesTable(session.user.id);
  return NextResponse.json({ tableId: table.id, existing: false });
}
