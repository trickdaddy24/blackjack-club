// Duo-table quick reactions (#6). One POST writes an emote onto the table row;
// the other seat picks it up on its next ~1.5s state poll, so this adds no new
// transport. Rejections are silent-by-design — a cooldown hit returns 200 with
// the unchanged list rather than an error the UI would have to explain.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seatOf } from "@/lib/table";
import { isEmote, parseEmotes, pushEmote, serializeEmotes } from "@/lib/emotes";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const slug = body?.slug;
  if (!isEmote(slug)) {
    return NextResponse.json({ error: "Unknown reaction" }, { status: 400 });
  }

  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  // Membership check is the authorization: only the two seated players may
  // react, and only at their own table.
  const seat = seatOf(table, userId);
  if (seat === null) return NextResponse.json({ error: "Not your table" }, { status: 404 });
  if (table.status === "ended") {
    return NextResponse.json({ error: "Table has ended" }, { status: 409 });
  }

  const now = Date.now();
  const next = pushEmote(parseEmotes(table.emotesJson), seat, slug, now);
  await prisma.table.update({
    where: { id },
    data: { emotesJson: serializeEmotes(next) },
  });

  return NextResponse.json({ emotes: next });
}
