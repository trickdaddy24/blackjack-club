import type { RoundState } from "@/lib/blackjack/engine";
import { handValue } from "@/lib/blackjack/engine";

// Shared by the profile page's "Recent Hands" and the admin round inspector —
// a server-side sanitized replay of a settled round's stateJson. NEVER ships
// the shoe (it holds future cards), only what was actually dealt/played.

const SUIT_GLYPH: Record<string, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function MiniCard({ rank, suit }: { rank: string; suit: string }) {
  const red = suit === "H" || suit === "D";
  return (
    <span
      className={`inline-flex items-center rounded border border-black/20 bg-[#f5efdc] px-1 font-mono text-[11px] font-bold ${
        red ? "text-red-700" : "text-slate-900"
      }`}
    >
      {rank}
      {SUIT_GLYPH[suit]}
    </span>
  );
}

/** Server-side sanitized replay — parses stateJson, NEVER ships the shoe. */
export function Replay({ state, mine }: { state: RoundState; mine: boolean }) {
  const dealerTotal = handValue(state.dealer).total;
  return (
    <div className="space-y-2 border-t border-[var(--gold)]/10 bg-black/25 px-5 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-[var(--cream)]/45">Dealer</span>
        {state.dealer.map((c, i) => (
          <MiniCard key={i} rank={c.rank} suit={c.suit} />
        ))}
        <span className="text-[var(--cream)]/55 tabular-nums">
          {dealerTotal}
          {dealerTotal > 21 ? " — BUST" : ""}
        </span>
      </div>
      {state.hands.map((h, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <span className="w-16 text-[var(--cream)]/45">
            {state.hands.length > 1 ? `Hand ${i + 1}` : mine ? "You" : "Hand"}
          </span>
          {h.cards.map((c, ci) => (
            <MiniCard key={ci} rank={c.rank} suit={c.suit} />
          ))}
          <span className="text-[var(--cream)]/55 tabular-nums">{handValue(h.cards).total}</span>
          {h.doubled && <span className="text-[var(--cream)]/45">×2</span>}
          {h.outcome && (
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-bold uppercase ${
                h.outcome === "lose"
                  ? "bg-red-900/60 text-red-200"
                  : h.outcome === "push"
                    ? "bg-black/40 text-[var(--cream)]/60"
                    : "bg-[var(--gold)]/70 text-black"
              }`}
            >
              {h.outcome}
            </span>
          )}
          {[
            ["PP", h.pp],
            ["21+3", h.tp],
            ["LL", h.ll],
          ].map(([label, sb]) =>
            sb && typeof sb === "object" ? (
              <span
                key={label as string}
                className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
                  sb.payout > 0 ? "bg-emerald-500/25 text-emerald-200" : "bg-black/40 text-[var(--cream)]/40"
                }`}
              >
                {label as string} {sb.payout > 0 ? `+${sb.payout - sb.bet}` : `−${sb.bet}`}
              </span>
            ) : null
          )}
        </div>
      ))}
      {(state.bustBet ?? 0) > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="w-16 text-[var(--cream)]/45">Bust bet</span>
          <span
            className={`rounded px-1 py-0.5 text-[10px] font-semibold ${
              (state.bustPayout ?? 0) > 0
                ? "bg-emerald-500/25 text-emerald-200"
                : "bg-black/40 text-[var(--cream)]/40"
            }`}
          >
            {(state.bustPayout ?? 0) > 0
              ? `dealer busted +${(state.bustPayout ?? 0) - state.bustBet}`
              : `dealer stood −${state.bustBet}`}
          </span>
        </div>
      )}
    </div>
  );
}
