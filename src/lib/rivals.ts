// Duo-table rivalries: pair my per-player Round rows with the opposing row
// from the same table (settled in the same transaction, so timestamps sit
// within milliseconds — 5s tolerance is generous). "Winning the round" means
// the better total night: main net + side net, head to head.

import { prisma } from "@/lib/prisma";

export interface RivalRecord {
  userId: string;
  name: string;
  wins: number;
  losses: number;
  pushes: number;
  rounds: number;
}

export async function rivalRecords(meId: string): Promise<RivalRecord[]> {
  const mine = await prisma.round.findMany({
    where: { userId: meId, tableId: { not: null }, status: "settled" },
    select: { tableId: true, settledAt: true, netResult: true, sideNet: true },
  });
  if (mine.length === 0) return [];

  const tableIds = [...new Set(mine.map((r) => r.tableId!))];
  const theirs = await prisma.round.findMany({
    where: { tableId: { in: tableIds }, userId: { not: meId }, status: "settled" },
    select: {
      tableId: true,
      settledAt: true,
      netResult: true,
      sideNet: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
  const byTable = new Map<string, typeof theirs>();
  for (const t of theirs) {
    const arr = byTable.get(t.tableId!) ?? [];
    arr.push(t);
    byTable.set(t.tableId!, arr);
  }

  const records = new Map<string, RivalRecord>();
  for (const m of mine) {
    const candidates = byTable.get(m.tableId!) ?? [];
    let best: (typeof theirs)[number] | null = null;
    let bestDiff = 5_000;
    for (const c of candidates) {
      const d = Math.abs((c.settledAt?.getTime() ?? 0) - (m.settledAt?.getTime() ?? 0));
      if (d < bestDiff) {
        best = c;
        bestDiff = d;
      }
    }
    if (!best) continue;
    const rec =
      records.get(best.userId) ??
      ({
        userId: best.userId,
        name: best.user.name ?? "Player",
        wins: 0,
        losses: 0,
        pushes: 0,
        rounds: 0,
      } as RivalRecord);
    const myTotal = m.netResult + m.sideNet;
    const theirTotal = best.netResult + best.sideNet;
    if (myTotal > theirTotal) rec.wins++;
    else if (myTotal < theirTotal) rec.losses++;
    else rec.pushes++;
    rec.rounds++;
    records.set(best.userId, rec);
  }
  return [...records.values()].sort((a, b) => b.rounds - a.rounds);
}
