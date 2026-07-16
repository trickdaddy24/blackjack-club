import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTableView, placeTableBet, TableError } from "@/lib/table";

/** POST {bet, pp, tp, ll}: my next-round wager. Second wager in → the deal. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  let body: { bet?: unknown; pp?: unknown; tp?: unknown; ll?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const num = (v: unknown) => (typeof v === "number" ? v : 0);

  try {
    const { table: fresh, unlocked } = await placeTableBet(table, session.user.id, {
      bet: num(body.bet),
      sides: { pp: num(body.pp), tp: num(body.tp), ll: num(body.ll) },
    });
    const mine = unlocked.get(session.user.id) ?? [];
    return NextResponse.json({
      table: await buildTableView(fresh, session.user.id),
      ...(mine.length > 0 ? { unlocked: mine } : {}),
    });
  } catch (err) {
    if (err instanceof TableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
