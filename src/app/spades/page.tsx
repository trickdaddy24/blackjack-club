"use client";

import Link from "next/link";
import type { Card } from "@/spades/engine/cards";
import { cardId } from "@/spades/engine/cards";
import { HUMAN_SEAT, handSorted } from "@/spades/engine/game";
import { isLegalPlay } from "@/spades/engine/rules";
import type { Seat } from "@/spades/engine/types";
import { CardBack, CardView } from "@/spades/ui/CardView";
import { BidPanel, HandResultPanel, Scoreboard, SeatBadge } from "@/spades/ui/panels";
import { useSpades } from "@/spades/ui/useSpades";
import "@/spades/spades.css";

const SPADES_VERSION = "0.1.0";
const TRICK_POS: Record<Seat, string> = { 0: "trick__s", 1: "trick__w", 2: "trick__n", 3: "trick__e" };

export default function SpadesPage() {
  const { state, humansTurn, holding, displayTrick, trickWinnerSeat, bid, play, nextHand, restart } =
    useSpades();

  const myHand = handSorted(state, HUMAN_SEAT);
  const canPlay = (c: Card) =>
    humansTurn && state.phase === "playing"
    && isLegalPlay(c, state.hands[HUMAN_SEAT], state.currentTrick, state.spadesBroken);

  const phaseMsg = () => {
    if (state.phase === "bidding") return humansTurn ? "Your bid" : "Bidding…";
    if (state.phase === "playing") {
      if (holding) return trickWinnerSeat !== null
        ? `${["You", "West", "North", "East"][trickWinnerSeat]} takes the trick`
        : "";
      return humansTurn ? "Your turn — play a card" : "Playing…";
    }
    return "";
  };

  return (
    <div className="spades-app">
      <div className="app">
        <header className="topbar">
          <div className="brand">Spades<span>Club</span><i className="ver">v{SPADES_VERSION}</i></div>
          <Scoreboard state={state} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="topbar__new" onClick={restart}>New game</button>
            <Link className="topbar__new" href="/" style={{ textDecoration: "none" }}>♠ Club</Link>
          </div>
        </header>

        <main className="table">
          <div className="table__n"><SeatBadge state={state} seat={2} active={state.turn === 2} /></div>
          <div className="table__w"><SeatBadge state={state} seat={1} active={state.turn === 1} /></div>
          <div className="table__e"><SeatBadge state={state} seat={3} active={state.turn === 3} /></div>

          <div className={`trick ${holding ? "trick--held" : ""}`}>
            {displayTrick.map((p) => (
              <div key={p.seat} className={`trick__slot ${TRICK_POS[p.seat as Seat]} ${trickWinnerSeat === p.seat ? "trick__slot--win" : ""}`}>
                <CardView card={p.card} small />
              </div>
            ))}
            {displayTrick.length === 0 && state.phase === "playing" && (
              <div className="trick__hint">{state.spadesBroken ? "spades broken" : "spades not broken"}</div>
            )}
            <div className="trick__msg">{phaseMsg()}</div>
          </div>

          <div className="oppcards oppcards--n">{backs(state.hands[2].length)}</div>
          <div className="oppcards oppcards--w">{backs(state.hands[1].length, true)}</div>
          <div className="oppcards oppcards--e">{backs(state.hands[3].length, true)}</div>

          <div className="table__s"><SeatBadge state={state} seat={0} active={state.turn === 0} /></div>
        </main>

        <section className="myhand">
          {myHand.map((c) => (
            <CardView
              key={cardId(c)}
              card={c}
              playable={canPlay(c)}
              disabled={state.phase === "playing" && !canPlay(c)}
              onClick={state.phase === "playing" ? () => play(c) : undefined}
            />
          ))}
        </section>

        {state.phase === "bidding" && humansTurn && (
          <BidPanel onBid={bid} canBlindNil={state.bids[HUMAN_SEAT] === null} />
        )}

        {(state.phase === "handComplete" || state.phase === "gameOver") && state.lastHandResult && (
          <HandResultPanel result={state.lastHandResult} state={state} onNext={nextHand} onRestart={restart} />
        )}

        <footer className="foot">
          Partnership Spades · Nil · Blind Nil · to {state.targetScore} ·{" "}
          <Link href="/play">Blackjack ♠♥♦♣</Link>
        </footer>
      </div>
    </div>
  );
}

function backs(n: number, side = false) {
  return (
    <div className={`backs ${side ? "backs--side" : ""}`}>
      {Array.from({ length: n }, (_, i) => <CardBack key={i} small />)}
    </div>
  );
}
