import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyTableAction, buildTableView, TableError } from "@/lib/table";
import type { PlayerAction } from "@/lib/blackjack/engine";

const ACTIONS: PlayerAction[] = ["hit", "stand", "double", "split", "surrender"];

/** POST {action}: turn-locked play on the shared round. */
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

  let action: unknown;
  try {
    ({ action } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof action !== "string" || !ACTIONS.includes(action as PlayerAction)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    const { table: fresh, unlocked } = await applyTableAction(
      table,
      session.user.id,
      action as PlayerAction
    );
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
