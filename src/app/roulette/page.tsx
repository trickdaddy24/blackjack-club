"use client";

import Link from "next/link";
import { CHIP_DENOMS } from "@/roulette/engine/game";
import { pocketColor } from "@/roulette/engine/wheel";
import type { WheelKind } from "@/roulette/engine/types";
import { Table } from "@/roulette/ui/Table";
import { Wheel } from "@/roulette/ui/Wheel";
import { useRoulette } from "@/roulette/ui/useRoulette";
import "@/roulette/roulette.css";

// Shared hub version, baked from the VERSION file at build (always on screen).
const ROULETTE_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.11.0";

function chipTier(amount: number): string {
  if (amount >= 500) return "chip--gold";
  if (amount >= 100) return "chip--blue";
  if (amount >= 25) return "chip--green";
  if (amount >= 5) return "chip--red";
  return "chip--white";
}

export default function RoulettePage() {
  const r = useRoulette();
  const { state, staked } = r;
  const canSpin = staked > 0 && !state.spinning;

  return (
    <div className="roulette-app">
      <div className="app">
        <header className="topbar">
          <div className="brand">Roulette<span>Club</span><i className="ver">v{ROULETTE_VERSION}</i></div>
          <div className="wheelpick">
            {(["european", "american"] as WheelKind[]).map((w) => (
              <button
                key={w}
                className={`wheelpick__btn ${state.wheel === w ? "is-on" : ""}`}
                disabled={state.spinning}
                onClick={() => r.setWheel(w)}
              >
                {w === "european" ? "European (0)" : "American (0 · 00)"}
              </button>
            ))}
          </div>
          <div className="bankroll">
            <span className="bankroll__label">Balance</span>
            <span className="bankroll__amt">${state.balance.toLocaleString()}</span>
            <button className="bankroll__reset" disabled={state.spinning} onClick={r.resetBankroll} title="Reset to $1,000">↺</button>
          </div>
        </header>

        <main className="felt">
          <section className="wheelcol">
            <Wheel wheel={state.wheel} spinId={r.spinId} targetIndex={r.targetIndex} onDone={r.onSpinDone} size={300} />
            <ResultBanner state={state} />
            <div className="history">
              {state.history.length === 0
                ? <span className="history__empty">No spins yet</span>
                : state.history.map((p, i) => (
                  <span key={i} className={`hist hist--${pocketColor(p)}`}>{p}</span>
                ))}
            </div>
          </section>

          <section className="tablecol">
            <Table
              spots={r.spots}
              bets={state.bets}
              wheel={state.wheel}
              lastResult={state.lastResult}
              onPlace={r.place}
            />

            <div className="rack">
              {CHIP_DENOMS.map((d) => (
                <button
                  key={d}
                  className={`rackchip ${chipTier(d)} ${state.chip === d ? "is-on" : ""}`}
                  disabled={state.spinning}
                  onClick={() => r.setChip(d)}
                >
                  {d}
                </button>
              ))}
              <span className="rack__staked">Staked&nbsp;<b>${staked.toLocaleString()}</b></span>
            </div>

            <div className="actions">
              <button className="btn" disabled={state.spinning || Object.keys(state.bets).length === 0} onClick={r.undo}>Undo</button>
              <button className="btn" disabled={state.spinning || Object.keys(state.bets).length === 0} onClick={r.clear}>Clear</button>
              <button className="btn" disabled={state.spinning || Object.keys(state.bets).length > 0 || state.lastBets.length === 0} onClick={r.rebet}>Rebet</button>
              <button className="btn btn--spin" disabled={!canSpin} onClick={r.spin}>
                {state.spinning ? "Spinning…" : "Spin"}
              </button>
            </div>
          </section>
        </main>

        <footer className="foot">
          Play-money roulette · {state.wheel === "american" ? "American double-zero" : "European single-zero"} ·
          balance saved in this browser ·{" "}
          <Link href="/">♠ Club</Link> · <Link href="/spades">Spades</Link> · <Link href="/play">Blackjack</Link>
        </footer>
      </div>
    </div>
  );
}

function ResultBanner({ state }: { state: ReturnType<typeof useRoulette>["state"] }) {
  const res = state.lastResult;
  if (state.spinning) return <div className="result result--idle">Spinning…</div>;
  if (!res) return <div className="result result--idle">Place your bets</div>;
  const win = res.net > 0;
  return (
    <div className={`result ${win ? "result--win" : res.net < 0 ? "result--lose" : "result--push"}`}>
      <span className={`result__pocket hist--${res.color}`}>{res.pocket}</span>
      <span className="result__net">
        {res.net > 0 ? `Won $${res.net.toLocaleString()}` : res.net < 0 ? `Lost $${(-res.net).toLocaleString()}` : "Push"}
      </span>
    </div>
  );
}
