// Pit-boss console helpers. Role lives on User.role and is re-fetched from
// the DB by the jwt callback on EVERY request, so a fresh session check here
// is authoritative — no stale-JWT risk.

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Shared by /admin/audit (global feed) and /admin/users/[id] (per-player
// slice) — one label map so the two views never drift apart.
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "chips-adjust": "💰 Chips adjusted",
  "role-set": "🚫 Role changed",
  "achievement-grant": "🏆 Trophy granted",
  "achievement-revoke": "🗑️ Trophy revoked",
  purge: "🧹 Purge",
  "jackpot-set": "🎰 Jackpot set",
  "promo-force": "🔥 Promo forced",
  "password-reset": "🔑 Password reset",
};

/** Session user id when the requester is an admin, else null. */
export async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  // Double-check against the DB — the console mutates money.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "admin" ? session.user.id : null;
}

/** Every mutating admin action writes an audit row. detail is JSON. */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetId: string | null,
  detail: Record<string, unknown>
) {
  await prisma.adminAction.create({
    data: { adminId, action, targetId, detail: JSON.stringify(detail) },
  });
}
