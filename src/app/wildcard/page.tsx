"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sounds } from "@/lib/sound";
import type { Color } from "@/wildcard/engine/cards";
import { COLOR_NAME, COLORS } from "@/wildcard/engine/cards";
import { canPlay } from "@/wildcard/engine/rules";
import { HUMAN_SEAT, SEAT_NAME, topCard } from "@/wildcard/engine/game";
import type { Seat } from "@/wildcard/engine/game";
import { CardBack, CardView } from "@/wildcard/ui/CardView";
import { useWildcard } from "@/wildcard/ui/useWildcard";
import "@/wildcard/wildcard.css";

// Shared hub version, baked from the VERSION file at build (always on screen).
const WC_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.12.0";

export default function WildcardPage() {
  const g = useWildcard();
  const { state } = g;
  // Shares the club-wide mute switch (same localStorage key as blackjack)
  const [muted, setMutedState] = useState(false);
  // The deal is random, so SSR and client produce different cards — render
  // the table only after mount so hydration always matches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMutedState(sounds.muted);
    setMounted(true);
  }, []);
  const toggleMute = () => {
    sounds.setMuted(!muted);
    setMutedState(!muted);
  };
  const top = topCard(state);
  const myHand = state.hands[HUMAN_SEAT];
  const canAct = g.humansTurn && !g.humanDrawnPending && !g.pendingWild;

  const playableNow = (cardId: number) => {
    const c = myHand.find((x) => x.id === cardId)!;
    return canAct && canPlay(c, top.kind, state.activeColor);
  };

  if (!mounted) return <div className="wildcard-app" />;

  return (
    <div className="wildcard-app">
      <div className="app">
        <header className="topbar">
          <div className="brand">WildCard<span>Club</span><i className="ver">v{WC_VERSION}</i></div>
          <div className="scores">
            {([0, 1, 2, 3] as Seat[]).map((s) => (
              <div key={s} className={`scorechip ${state.turn === s && state.phase === "playing" ? "scorechip--active" : ""}`}>
                <span className="scorechip__name">{SEAT_NAME[s]}</span>
                <span className="scorechip__pts">{state.scores[s]}</span>
              </div>
            ))}
            <span className="scores__target">to {state.targetScore}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="topbar__new"
              onClick={toggleMute}
              title={muted ? "Unmute sounds" : "Mute sounds"}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button className="topbar__new" onClick={g.restart}>New game</button>
            <Link className="topbar__new" href="/" style={{ textDecoration: "none" }}>♠ Club</Link>
          </div>
        </header>

        <main className="table">
          <div className="opp opp--n">
            <SeatTag seat={2} state={state} />
            <div className="backs">{backs(state.hands[2].length)}</div>
          </div>
          <div className="opp opp--w">
            <SeatTag seat={1} state={state} />
            <div className="backs backs--side">{backs(state.hands[1].length)}</div>
          </div>
          <div className="opp opp--e">
            <SeatTag seat={3} state={state} />
            <div className="backs backs--side">{backs(state.hands[3].length)}</div>
          </div>

          <div className="center">
            <div className={`dirarrow ${state.direction === -1 ? "dirarrow--ccw" : ""}`} title="Play direction">
              {state.direction === 1 ? "⟳" : "⟲"}
            </div>
            <button className="drawpile" onClick={g.draw} disabled={!canAct} title="Draw a card">
              <CardBack />
              <span className="drawpile__count">{state.drawPile.length}</span>
            </button>
            <div className={`discard glow--${state.activeColor}`}>
              <CardView card={top} />
            </div>
            <div className={`colorpip colorpip--${state.activeColor}`} title={`Active color: ${COLOR_NAME[state.activeColor]}`} />
          </div>

          <div className="msg">{statusLine()}</div>
        </main>

        <section className="myhand">
          {myHand.map((c) => (
            <CardView
              key={c.id}
              card={c}
              playable={playableNow(c.id)}
              disabled={!playableNow(c.id)}
              onClick={canAct ? () => g.play(c) : undefined}
            />
          ))}
        </section>

        <section className="actions">
          <button
            className={`lastcard ${g.declareArmed ? "lastcard--armed" : ""} ${myHand.length === 2 && g.humansTurn ? "lastcard--urgent" : ""}`}
            disabled={!g.humansTurn}
            onClick={() => g.setDeclareArmed(!g.declareArmed)}
            title="Arm before playing your second-to-last card, or draw 2 as a penalty"
          >
            {g.declareArmed ? "✓ Last card armed" : "Last card!"}
          </button>
          <span className="actions__hint">
            {g.humansTurn ? "Your turn — play a card or draw" : state.phase === "playing" ? "Bots are playing…" : ""}
          </span>
        </section>

        {g.humanDrawnPending && (
          <div className="sheet">
            <div className="sheet__card">
              <p>You drew a playable card:</p>
              <div className="sheet__preview">
                <CardView card={myHand.find((c) => c.id === g.humanDrawnPending!.cardId)!} />
              </div>
              <div className="sheet__row">
                <button className="bigbtn" onClick={g.playTheDrawn}>Play it</button>
                <button className="bigbtn bigbtn--ghost" onClick={g.keepTheDrawn}>Keep it</button>
              </div>
            </div>
          </div>
        )}

        {g.pendingWild && (
          <div className="sheet">
            <div className="sheet__card">
              <p>Pick a color</p>
              <div className="sheet__row">
                {COLORS.map((c: Color) => (
                  <button key={c} className={`colorbtn colorbtn--${c}`} onClick={() => g.pickColor(c)}>
                    {COLOR_NAME[c]}
                  </button>
                ))}
              </div>
              <button className="sheet__cancel" onClick={g.cancelWild}>Cancel</button>
            </div>
          </div>
        )}

        {(state.phase === "handComplete" || state.phase === "gameOver") && state.lastHandResult && (
          <div className="sheet">
            <div className="sheet__card sheet__card--wide">
              <h2 className="sheet__title">
                {state.phase === "gameOver"
                  ? (state.winner === HUMAN_SEAT ? "🏆 You win the game!" : `${SEAT_NAME[state.winner as Seat]} wins the game`)
                  : `${SEAT_NAME[state.lastHandResult.winner]} wins hand ${state.lastHandResult.handNumber} (+${state.lastHandResult.points})`}
              </h2>
              <table className="resulttable">
                <thead><tr><th>Player</th><th>Cards left</th><th>Value</th><th>Total score</th></tr></thead>
                <tbody>
                  {state.lastHandResult.leftover.map((l) => (
                    <tr key={l.seat} className={l.seat === state.lastHandResult!.winner ? "resulttable__winner" : ""}>
                      <td>{SEAT_NAME[l.seat]}</td>
                      <td>{l.cards}</td>
                      <td>{l.value}</td>
                      <td>{state.scores[l.seat]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {state.phase === "gameOver"
                ? <button className="bigbtn" onClick={g.restart}>New game</button>
                : <button className="bigbtn" onClick={g.nextHand}>Deal next hand</button>}
            </div>
          </div>
        )}

        <footer className="foot">
          Color-shedding card game vs three bots · to {state.targetScore} ·{" "}
          <Link href="/">♠ Club</Link> · <Link href="/spades">Spades</Link> ·{" "}
          <Link href="/roulette">Roulette</Link> · <Link href="/play">Blackjack</Link>
        </footer>
      </div>
    </div>
  );

  function statusLine(): string {
    if (state.phase !== "playing") return state.lastAction;
    return state.lastAction || (g.humansTurn ? "Your turn" : `${SEAT_NAME[state.turn]} is thinking…`);
  }
}

function SeatTag({ seat, state }: { seat: Seat; state: ReturnType<typeof useWildcard>["state"] }) {
  const active = state.phase === "playing" && state.turn === seat;
  const n = state.hands[seat].length;
  return (
    <div className={`seattag ${active ? "seattag--active" : ""} ${n === 1 ? "seattag--uno" : ""}`}>
      {SEAT_NAME[seat]} · {n} {n === 1 ? "card ⚠" : "cards"}
    </div>
  );
}

function backs(n: number) {
  const shown = Math.min(n, 10);
  return Array.from({ length: shown }, (_, i) => <CardBack key={i} small />);
}
