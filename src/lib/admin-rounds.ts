import { prisma } from "@/lib/prisma";
import { vegasDayStart, vegasWeekStart } from "@/lib/leaderboard";
import type { RoundState } from "@/lib/blackjack/engine";

// Shared by the round inspector page and its API route — rounds are
// never edited here (see docs/ADMIN-CONSOLE.md: "read-only by design").

export interface RoundFilters {
  /** Search by player name/email. */
  q?: string;
  /** Settled-window on the Vegas clock. */
  window?: "today" | "week" | "all";
  /** Only rounds whose |net| is at least this many chips. */
  minNet?: number;
  take?: number;
}

export interface AdminRound {
  id: string;
  userId: string;
  userName: string;
  bet: number;
  netResult: number;
  sideNet: number;
  total: number;
  tableId: string | null;
  createdAt: Date;
  state: RoundState | null;
}

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

export async function findRounds(filters: RoundFilters): Promise<AdminRound[]> {
  const window = filters.window ?? "today";
  const since =
    window === "today" ? vegasDayStart() : window === "week" ? vegasWeekStart() : undefined;
  const q = filters.q?.trim();
  const take = Math.min(Math.max(filters.take ?? DEFAULT_TAKE, 1), MAX_TAKE);
  // A net-threshold filter runs in JS below (total = netResult + sideNet
  // isn't a column), so over-fetch the window to give it something to work with.
  const fetchTake = filters.minNet ? MAX_TAKE : take;

  const rows = await prisma.round.findMany({
    where: {
      status: "settled",
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(q ? { user: { OR: [{ name: { contains: q } }, { email: { contains: q } }] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: fetchTake,
    select: {
      id: true,
      userId: true,
      bet: true,
      netResult: true,
      sideNet: true,
      tableId: true,
      createdAt: true,
      stateJson: true,
      user: { select: { name: true, email: true } },
    },
  });

  const parsed: AdminRound[] = rows.map((r) => {
    let state: RoundState | null = null;
    try {
      const parsed = JSON.parse(r.stateJson) as RoundState;
      // A handful of legacy rows have stateJson "{}" — valid JSON, not a
      // real RoundState. Treat anything missing the shoe as unreplayable.
      if (Array.isArray(parsed.dealer) && Array.isArray(parsed.hands)) state = parsed;
    } catch {
      /* pre-parse rounds render without a replay */
    }
    return {
      id: r.id,
      userId: r.userId,
      userName: r.user.name ?? r.user.email,
      bet: r.bet,
      netResult: r.netResult,
      sideNet: r.sideNet,
      total: r.netResult + r.sideNet,
      tableId: r.tableId,
      createdAt: r.createdAt,
      state,
    };
  });

  const filtered =
    filters.minNet != null ? parsed.filter((r) => Math.abs(r.total) >= filters.minNet!) : parsed;

  return filtered.slice(0, take);
}
