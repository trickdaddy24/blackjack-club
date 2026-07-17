import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVipStatus } from "@/lib/vip-io";

/** GET: current VIP tier + progress, paying any newly-earned tier-up bonus. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getVipStatus(session.user.id);
  return NextResponse.json({
    chips: status.chips,
    roundsPlayed: status.roundsPlayed,
    tieredUp: status.tieredUp,
    bonusAwarded: status.bonusAwarded,
    tier: {
      tier: status.tier.tier,
      name: status.tier.name,
      badge: status.tier.badge,
      dailyBonusBoostPct: status.tier.dailyBonusBoostPct,
    },
    next: status.next
      ? { name: status.next.name, badge: status.next.badge, threshold: status.next.threshold }
      : null,
  });
}
