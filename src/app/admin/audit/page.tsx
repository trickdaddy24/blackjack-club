import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { TopBar } from "@/components/TopBar";

export const metadata = {
  title: "Audit Log — Blackjack Club",
};

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "chips-adjust": "💰 Chips adjusted",
  "role-set": "🚫 Role changed",
  "password-reset": "🔑 Password reset",
  "achievement-grant": "🏆 Trophy granted",
  "achievement-revoke": "🗑️ Trophy revoked",
  purge: "🧹 Purge",
  "jackpot-set": "🎰 Jackpot set",
  "promo-force": "🔥 Promo forced",
};

export default async function AuditPage() {
  const adminId = await requireAdmin();
  if (!adminId) notFound();

  const actions = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve actor/target names in one query each way
  const ids = [
    ...new Set([
      ...actions.map((a) => a.adminId),
      ...actions.map((a) => a.targetId).filter((x): x is string => Boolean(x)),
    ]),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? u.email]));

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-red-900/80 py-1 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-red-100">
        Pit Boss Console
      </div>
      <TopBar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">Audit Log</h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            Last 100 console actions ·{" "}
            <Link href="/admin" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              players
            </Link>
            {" · "}
            <Link href="/admin/rounds" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              round inspector
            </Link>
            {" · "}
            <Link href="/admin/house" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              house
            </Link>
          </p>
        </div>

        <ul
          className="fade-up gold-ring mt-6 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
          style={{ animationDelay: "100ms" }}
        >
          {actions.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
              Nothing yet — a clean book.
            </li>
          )}
          {actions.map((a) => {
            let detail: Record<string, unknown> = {};
            try {
              detail = JSON.parse(a.detail);
            } catch {}
            return (
              <li key={a.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold text-[var(--cream)]/90">
                    {ACTION_LABELS[a.action] ?? a.action}
                  </span>
                  <span className="text-[var(--cream)]/50">
                    by {nameOf.get(a.adminId) ?? a.adminId}
                    {a.targetId ? <> → {nameOf.get(a.targetId) ?? "(deleted account)"}</> : null}
                  </span>
                  <span className="ml-auto text-xs text-[var(--cream)]/40">
                    {a.createdAt.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 break-words text-xs text-[var(--cream)]/55">
                  {Object.entries(detail).map(([k, v]) => (
                    <span key={k} className="mr-3">
                      <span className="text-[var(--cream)]/35">{k}:</span>{" "}
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
