import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { findRounds, type RoundFilters } from "@/lib/admin-rounds";

export async function GET(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const window = searchParams.get("window");
  const minNetRaw = searchParams.get("minNet");
  const minNet = minNetRaw ? Number(minNetRaw) : undefined;

  const filters: RoundFilters = {
    q: searchParams.get("q") ?? undefined,
    window: window === "week" || window === "all" ? window : "today",
    minNet: minNet != null && Number.isFinite(minNet) && minNet > 0 ? minNet : undefined,
  };

  const rounds = await findRounds(filters);
  return NextResponse.json({ rounds });
}
