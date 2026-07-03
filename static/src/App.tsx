import { Spade } from "lucide-react";
import { GameTable } from "./GameTable";
import { STARTING_CHIPS } from "./localGame";

export function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-3 py-4">
        <div className="flex items-center gap-2">
          <Spade className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" />
          <span className="font-display text-lg font-bold tracking-[0.2em] gold-text">
            BLACKJACK CLUB
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-[var(--cream)]/40">
          Play-money · saved on this device
        </span>
      </header>

      <GameTable />

      <footer className="flex items-center justify-center gap-3 pb-5 pt-3 text-xs text-[var(--cream)]/30">
        <span>No purchases, no payouts — just cards.</span>
        <button
          className="underline-offset-4 hover:text-[var(--cream)]/60 hover:underline"
          onClick={() => {
            if (window.confirm(`Reset your bankroll to ${STARTING_CHIPS.toLocaleString()} chips?`)) {
              localStorage.removeItem("bj-chips");
              localStorage.removeItem("bj-round");
              location.reload();
            }
          }}
        >
          Reset bankroll
        </button>
      </footer>
    </div>
  );
}
