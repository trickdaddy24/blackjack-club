import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { findRounds } from "@/lib/admin-rounds";
import { TopBar } from "@/components/TopBar";
import { Replay } from "@/components/HandReplay";

export const metadata = {
  title: "Round Inspector — Blackjack Club",
};

// Console pages must never be cached or statically built
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-xl border border-[var(--gold)]/25 bg-black/40 px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[var(--cream)]/30 focus:outline-none focus:border-[var(--gold)]/60";

export default async function RoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; window?: string; minNet?: string; userId?: string }>;
}) {
  const adminId = await requireAdmin();
  if (!adminId) notFound(); // 404, not 403 — the console stays invisible

  const { q, window: windowParam, minNet: minNetParam, userId } = await searchParams;
  const window = windowParam === "week" || windowParam === "all" ? windowParam : "today";
  const minNet = minNetParam ? Number(minNetParam) : undefined;

  const rounds = await findRounds({
    q,
    userId,
    window,
    minNet: minNet != null && Number.isFinite(minNet) && minNet > 0 ? minNet : undefined,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-red-900/80 py-1 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-red-100">
        Pit Boss Console
      </div>
      <TopBar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            Round Inspector
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            Read-only — rounds are never edited here ·{" "}
            <Link href="/admin" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              players
            </Link>
            {" · "}
            <Link href="/admin/house" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              house
            </Link>
            {" · "}
            <Link href="/admin/audit" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              audit log
            </Link>
          </p>
        </div>

        {userId && (
          <p className="fade-up mt-4 text-sm text-[var(--cream)]/50" style={{ animationDelay: "40ms" }}>
            Filtered to {rounds[0]?.userName ?? "one player"} ·{" "}
            <Link href="/admin/rounds" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
              clear filter
            </Link>
          </p>
        )}

        <form
          className="fade-up mt-6 flex flex-wrap items-center gap-2"
          style={{ animationDelay: "60ms" }}
        >
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by player name or email…"
            className={`${inputCls} min-w-[220px] flex-1`}
            aria-label="Search players"
          />
          <select name="window" defaultValue={window} className={inputCls} aria-label="Settled window">
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="all">All time</option>
          </select>
          <input
            name="minNet"
            defaultValue={minNetParam ?? ""}
            placeholder="Min |net| e.g. 500"
            inputMode="numeric"
            className={`${inputCls} w-40`}
            aria-label="Minimum net swing"
          />
          <button type="submit" className={`${inputCls} font-semibold hover:bg-[var(--gold)]/10`}>
            Filter
          </button>
        </form>

        <ul
          className="fade-up gold-ring mt-4 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
          style={{ animationDelay: "100ms" }}
        >
          {rounds.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
              No rounds match those filters.
            </li>
          )}
          {rounds.map((r) => {
            const row = (
              <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <Link
                    href={`/admin/users/${r.userId}`}
                    className="font-display font-semibold text-[var(--cream)]/90 underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
                  >
                    {r.userName}
                  </Link>
                  {r.tableId && <span className="ml-1.5 text-[10px] text-[var(--cream)]/40">👥 duo</span>}
                  {r.state?.promo && (
                    <span className="ml-1.5 rounded bg-[var(--gold)]/15 px-1 py-0.5 text-[10px] font-semibold uppercase text-[var(--gold-bright)]">
                      {r.state.promo}
                    </span>
                  )}
                </span>
                <span className="text-[var(--cream)]/60">
                  {r.createdAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-[var(--cream)]/50 tabular-nums">bet {r.bet}</span>
                <span
                  className={`w-20 text-right font-semibold tabular-nums ${
                    r.total > 0
                      ? "text-[var(--gold-bright)]"
                      : r.total < 0
                        ? "text-red-300/80"
                        : "text-[var(--cream)]/50"
                  }`}
                >
                  {r.total > 0 ? `+${r.total}` : r.total}
                </span>
              </div>
            );
            return (
              <li key={r.id}>
                {r.state ? (
                  <details className="group">
                    <summary className="cursor-pointer list-none transition-colors hover:bg-[var(--gold)]/5 group-open:bg-[var(--gold)]/5">
                      {row}
                    </summary>
                    <Replay state={r.state} mine={false} />
                  </details>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
