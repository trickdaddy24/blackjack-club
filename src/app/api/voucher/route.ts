import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getVoucherState } from "@/lib/voucher-io";

/** GET: current match-play voucher status, granting a fresh one if earned. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getVoucherState(session.user.id);
  return NextResponse.json({
    active: state.active,
    expiresAt: state.expiresAt?.toISOString() ?? null,
    justGranted: state.justGranted,
  });
}
