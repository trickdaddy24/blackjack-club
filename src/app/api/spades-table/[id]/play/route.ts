import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildSpadesTableView, playSpadesCard, SpadesTableError } from "@/lib/spades-table";
import type { Card, Rank, Suit } from "@/spades/engine/cards";

const VALID_SUITS: Suit[] = ["C", "D", "H", "S", "JOKER"];
const VALID_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 20, 21];

function isCard(v: unknown): v is Card {
  if (!v || typeof v !== "object") return false;
  const c = v as { suit?: unknown; rank?: unknown };
  return (
    typeof c.suit === "string" &&
    VALID_SUITS.includes(c.suit as Suit) &&
    typeof c.rank === "number" &&
    VALID_RANKS.includes(c.rank as Rank)
  );
}

/** POST {card}: turn-locked card play on the live trick. The engine itself
 *  re-verifies the card is actually in the actor's hand and legal to play —
 *  this route only checks the JSON shape is well-formed. */
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
  const { card } = (body ?? {}) as { card?: unknown };
  if (!isCard(card)) {
    return NextResponse.json({ error: "card must be {suit, rank}" }, { status: 400 });
  }

  try {
    const fresh = await playSpadesCard(table, session.user.id, card);
    return NextResponse.json({ table: await buildSpadesTableView(fresh, session.user.id) });
  } catch (err) {
    if (err instanceof SpadesTableError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
