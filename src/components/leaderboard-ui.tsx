import Link from "next/link";
import { Crown, Medal } from "lucide-react";

// Shared leaderboard rendering. Extracted when the Trilux boards moved onto
// their own page (/leaderboard/trilux) so both pages render rows identically —
// duplicating this was ~80 lines that would have drifted apart.

/** Top N shown before the "···  you" row. */
export const TOP_N = 10;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="font-mono text-sm text-[var(--cream)]/50 tabular-nums">{rank}</span>;
}

export interface RowData {
  id: string;
  name: string;
  /** Right-hand number (chips, net, or accuracy). */
  value: string;
  valueClass?: string;
  /** Small middle detail (member-since, rounds played, decision volume). */
  detail?: string;
  /** Achievements unlocked — rendered as a 🏆 chip after the name. */
  trophies?: number;
}

export function BoardList({
  rows,
  meRow,
  myRank,
  userId,
}: {
  rows: RowData[];
  meRow: RowData | null;
  myRank: number | null;
  userId: string;
}) {
  const render = (r: RowData, rank: number) => {
    const isMe = r.id === userId;
    return (
      <li
        key={`${r.id}-${rank}`}
        className={`flex items-center gap-4 px-5 py-3 ${
          isMe ? "bg-[var(--gold)]/10 shadow-[inset_2px_0_0_var(--gold)]" : ""
        }`}
      >
        <span className="flex w-8 items-center justify-center">
          <RankBadge rank={rank} />
        </span>
        <span className="flex-1 truncate font-display font-semibold text-[var(--cream)]/90">
          <Link
            href={isMe ? "/profile" : `/player/${r.id}`}
            className="underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
          >
            {r.name}
          </Link>
          {(r.trophies ?? 0) > 0 && (
            <span className="ml-2 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--cream)]/60">
              🏆 {r.trophies}
            </span>
          )}
          {isMe && (
            <span className="ml-2 rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gold-bright)]">
              you
            </span>
          )}
        </span>
        {r.detail && (
          <span className="hidden text-xs text-[var(--cream)]/40 sm:block">{r.detail}</span>
        )}
        <span
          className={`font-display text-lg font-bold tabular-nums ${r.valueClass ?? "gold-text"}`}
        >
          {r.value}
        </span>
      </li>
    );
  };

  return (
    <ul
      className="fade-up gold-ring mt-6 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
      style={{ animationDelay: "120ms" }}
    >
      {rows.length === 0 && (
        <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
          Nobody has qualified yet — the board is wide open.
        </li>
      )}
      {rows.map((r, i) => render(r, i + 1))}
      {meRow && myRank !== null && (
        <>
          <li className="px-5 py-1.5 text-center text-xs text-[var(--cream)]/30">···</li>
          {render(meRow, myRank)}
        </>
      )}
    </ul>
  );
}

export const fmtNet = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
export const netClass = (n: number) =>
  n > 0 ? "gold-text" : n < 0 ? "text-red-300/90" : "text-[var(--cream-dim)]";
