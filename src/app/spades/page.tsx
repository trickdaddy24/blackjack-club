"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Card } from "@/spades/engine/cards";
import { cardId } from "@/spades/engine/cards";
import { HUMAN_SEAT, handSorted } from "@/spades/engine/game";
import { isLegalPlay } from "@/spades/engine/rules";
import type { Seat } from "@/spades/engine/types";
import { CardBack, CardView } from "@/spades/ui/CardView";
import { BidPanel, HandResultPanel, Scoreboard, SeatBadge } from "@/spades/ui/panels";
import { useSpades } from "@/spades/ui/useSpades";
import "@/spades/spades.css";

// Show the real app version (baked from the VERSION file at build) so it's
// always on screen at the top — not a stale hardcoded standalone number.
const SPADES_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.9.0";
const TRICK_POS: Record<Seat, string> = { 0: "trick__s", 1: "trick__w", 2: "trick__n", 3: "trick__e" };

export default function SpadesPage() {
  const {
    state, humansTurn, holding, displayTrick, trickWinnerSeat,
    bid, play, nextHand, restart, setDeucesHigh, setJokers,
  } = useSpades();

  const deucesHigh = state.rules.deucesHigh;
  const jokers = state.rules.jokers;
  const isPromotedDeuce = (c: Card) => deucesHigh && c.rank === 2 && c.suit !== "S";

  // The deal is random, so SSR and client would produce different hands —
  // render the table only after mount so hydration always matches (same
  // fix already applied to Wild Card, v0.19.0).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="spades-app" />;

  const myHand = handSorted(state, HUMAN_SEAT);
  const canPlay = (c: Card) =>
    humansTurn && state.phase === "playing"
    && isLegalPlay(c, state.hands[HUMAN_SEAT], state.currentTrick, state.spadesBroken, state.rules);

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
          <div className="topbar__actions">
            <label className="ruletoggle" title="All four 2s become the highest trumps: 2♠ ▸ 2♥ ▸ 2♣ ▸ 2♦, above the A♠. Changing this starts a new game.">
              <input
                type="checkbox"
                checked={deucesHigh}
                onChange={(e) => setDeucesHigh(e.target.checked)}
              />
              <span>Deuces high</span>
            </label>
            <label className="ruletoggle" title="Big Joker and Little Joker replace 2♣/2♦ as the two highest trumps, above the A♠. Changing this starts a new game.">
              <input
                type="checkbox"
                checked={jokers}
                onChange={(e) => setJokers(e.target.checked)}
              />
              <span>Jokers</span>
            </label>
            <button className="topbar__new" onClick={() => restart()}>New game</button>
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
                <CardView card={p.card} small trump={isPromotedDeuce(p.card)} />
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
              trump={isPromotedDeuce(c)}
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
          Partnership Spades · Nil · Blind Nil · to {state.targetScore}
          {deucesHigh && " · Deuces high (2♠ 2♥ 2♣ 2♦ are top trumps)"}
          {jokers && " · Jokers (🃏 Big & Little are the top trumps, above the A♠)"} ·{" "}
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
