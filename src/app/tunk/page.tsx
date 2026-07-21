"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sounds } from "@/lib/sound";
import { describeMeld } from "@/tunk/engine/rules";
import { SEAT_NAME, TARGET_PURSE } from "@/tunk/engine/game";
import type { Seat } from "@/tunk/engine/game";
import { CardBack, CardView } from "@/tunk/ui/CardView";
import { useTunk } from "@/tunk/ui/useTunk";
import "@/tunk/tunk.css";

// Shared hub version, baked from the VERSION file at build (always on screen).
const TK_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.39.1";
const SEATS: Seat[] = [0, 1, 2, 3];

export default function TunkPage() {
  const g = useTunk();
  const { state } = g;
  const [muted, setMutedState] = useState(false);
  // The deal is random, so SSR and client produce different cards — render
  // the table only after mount so hydration always matches (same fix as
  // Wild Card / Dominoes).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMutedState(sounds.muted);
    setMounted(true);
  }, []);

  function toggleMute() {
    const next = !muted;
    sounds.setMuted(next);
    setMutedState(next);
  }

  // Sound cues off state transitions — a fresh hand, a hand settling, and
  // the game ending win/bust. Draws and discards get their own click-driven
  // cues below since they're always a direct human/bot action.
  useEffect(() => {
    if (!mounted) return;
    if (state.phase === "handComplete" && state.lastHandResult) {
      if (state.lastHandResult.mode === "tonk") sounds.blackjack();
      else if (state.lastHandResult.winnerSeat === 0) sounds.win();
      else sounds.push();
    } else if (state.phase === "gameOver") {
      if (state.outcome === "won") sounds.blackjack();
      else sounds.lose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.handNumber, mounted]);

  function draw(source: "stock" | "discard") {
    sounds.deal();
    g.draw(source);
  }

  function discard(cardId: number) {
    sounds.chip();
    g.discard(cardId);
  }

  function drop(mode: "tonk" | "drop") {
    sounds.chip();
    g.drop(mode);
  }

  if (!mounted) return <div className="tunk-app" />;

  const topDiscard = state.discard[state.discard.length - 1];
  const meldedIds = new Set(g.humanMeld.melds.flat().map((c) => c.id));
  const canAct = g.humansTurn;

  return (
    <div className="tunk-app">
      <div className="app">
        <header className="topbar">
          <div className="brand">Tunk<span>Club</span><i className="ver">v{TK_VERSION}</i></div>
          <div className="purses">
            {SEATS.map((s) => (
              <div key={s} className={`pursechip ${state.turn === s && state.phase === "playing" ? "pursechip--active" : ""} ${state.purses[s] < 0 ? "pursechip--neg" : ""}`}>
                <span className="pursechip__name">{SEAT_NAME[s]}</span>
                <span className="pursechip__amt">${state.purses[s]}</span>
              </div>
            ))}
            <span className="purses__target">bust at $0 · win at ${TARGET_PURSE}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="topbar__new"
              onClick={toggleMute}
              title={muted ? "Unmute sounds" : "Mute sounds"}
              aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
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
            <div className="pile">
              <CardBack onClick={canAct ? () => draw("stock") : undefined} disabled={!canAct} />
              <span className="pile__count">{state.stock.length}</span>
              <span className="pile__label">Stock</span>
            </div>
            <div className="pile">
              {topDiscard
                ? <CardView card={topDiscard} onClick={canAct ? () => draw("discard") : undefined} disabled={!canAct} />
                : <div className="tk-card tk-card--empty" />}
              <span className="pile__label">Discard</span>
            </div>
          </div>

          <div className="msg">{statusLine()}</div>
        </main>

        <section className="myhand">
          <div className="myhand__deadwood">
            Your deadwood: <b>{g.humanMeld.deadwoodValue}</b>
            {g.humanMeld.deadwoodValue === 0 && <span className="myhand__tonktag"> — Tonk ready!</span>}
          </div>
          <div className="myhand__cards">
            {g.humanHand.map((c) => (
              <CardView
                key={c.id}
                card={c}
                meld={meldedIds.has(c.id)}
                dead={!meldedIds.has(c.id)}
                disabled={!g.humanAwaitingDiscard}
                onClick={g.humanAwaitingDiscard ? () => discard(c.id) : undefined}
              />
            ))}
          </div>
        </section>

        <section className="actions">
          <button className="bigbtn bigbtn--tonk" disabled={!canAct || g.humanMeld.deadwoodValue !== 0} onClick={() => drop("tonk")}>
            Tonk! (clean sweep, ×2 payout)
          </button>
          <button className="bigbtn bigbtn--drop" disabled={!canAct} onClick={() => drop("drop")}>
            Drop {canAct ? `(${g.humanMeld.deadwoodValue} deadwood)` : ""}
          </button>
          <span className="actions__hint">
            {g.humanAwaitingDiscard
              ? "Choose a card to discard"
              : g.humansTurn
              ? "Draw from the stock or discard, Tonk a clean hand, or drop your deadwood"
              : state.phase === "playing" ? `${SEAT_NAME[state.turn]} is thinking…` : ""}
          </span>
        </section>

        {(state.phase === "handComplete" || state.phase === "gameOver") && state.lastHandResult && (
          <div className="sheet">
            <div className="sheet__card sheet__card--wide">
              <h2 className="sheet__title">
                {state.phase === "gameOver"
                  ? (state.outcome === "won" ? "🏆 You cashed out a winner!" : "💸 You busted out.")
                  : resultTitle()}
              </h2>
              <table className="resulttable">
                <thead><tr><th>Player</th><th>Hand</th><th>Melds</th><th>Deadwood</th><th>Δ</th><th>Purse</th></tr></thead>
                <tbody>
                  {state.lastHandResult.evals.map((e) => (
                    <tr key={e.seat} className={e.seat === state.lastHandResult!.winnerSeat ? "resulttable__winner" : ""}>
                      <td>{SEAT_NAME[e.seat]}</td>
                      <td className="resulttable__hand">
                        {e.deadwood.map((c) => <CardView key={c.id} card={c} small dead />)}
                        {e.melds.flat().map((c) => <CardView key={c.id} card={c} small meld />)}
                      </td>
                      <td>{e.melds.map((m, i) => <span key={i} className="meldtag">{describeMeld(m)}({m.length})</span>)}</td>
                      <td>{e.deadwoodValue}</td>
                      <td className={state.lastHandResult!.purseDeltas[e.seat] >= 0 ? "delta--pos" : "delta--neg"}>
                        {state.lastHandResult!.purseDeltas[e.seat] >= 0 ? "+" : ""}{state.lastHandResult!.purseDeltas[e.seat]}
                      </td>
                      <td>${state.purses[e.seat]}</td>
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
          Play-money Tunk (Tonk) card game vs three bots · bust at $0, cash out at ${TARGET_PURSE} · no sign-up ·{" "}
          <Link href="/">♠ Club</Link> · <Link href="/wildcard">Wild Card</Link> ·{" "}
          <Link href="/dominoes">Dominoes</Link> · <Link href="/rules/tunk">Rules</Link>
        </footer>
      </div>
    </div>
  );

  function statusLine(): string {
    if (state.phase !== "playing") return state.lastAction;
    return state.lastAction || (g.humansTurn ? "Your turn" : `${SEAT_NAME[state.turn]} is thinking…`);
  }

  function resultTitle(): string {
    const r = state.lastHandResult!;
    if (r.mode === "tonk") return `${SEAT_NAME[r.dropperSeat as Seat]} called Tonk! Clean sweep.`;
    if (r.mode === "wash") return `Hand ${r.handNumber} — stock ran dry, ${SEAT_NAME[r.winnerSeat]} shows lowest.`;
    return r.winnerSeat === r.dropperSeat
      ? `${SEAT_NAME[r.dropperSeat as Seat]} dropped and won hand ${r.handNumber}.`
      : `${SEAT_NAME[r.dropperSeat as Seat]} dropped — ${SEAT_NAME[r.winnerSeat]} caught them!`;
  }
}

function SeatTag({ seat, state }: { seat: Seat; state: ReturnType<typeof useTunk>["state"] }) {
  const active = state.phase === "playing" && (state.awaitingDiscard ?? state.turn) === seat;
  return (
    <div className={`seattag ${active ? "seattag--active" : ""}`}>
      {SEAT_NAME[seat]} · ${state.purses[seat]}
    </div>
  );
}

function backs(n: number) {
  return Array.from({ length: n }, (_, i) => <CardBack key={i} small />);
}
