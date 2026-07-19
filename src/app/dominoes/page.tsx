"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sounds } from "@/lib/sound";
import { handPips } from "@/dominoes/engine/tiles";
import type { End } from "@/dominoes/engine/types";
import { TileBack, TileView } from "@/dominoes/ui/TileView";
import { HUMAN_SEAT, useDominoes } from "@/dominoes/ui/useDominoes";
import "@/dominoes/dominoes.css";

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
const BOT_SEAT = 1;

export default function DominoesPage() {
  const { state, humansTurn, humanLegal, humanMustDraw, play, draw, restart } = useDominoes();
  const [selected, setSelected] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  // The deal is random, so SSR and client would produce different tiles —
  // render the table only after mount so hydration always matches (same
  // fix already applied to Wild Card).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMutedState(sounds.muted);
    setMounted(true);
  }, []);

  // Sound cues off state transitions: a play/draw, and the round ending.
  useEffect(() => {
    if (!mounted) return;
    if (state.phase === "roundOver" && state.outcome) {
      if (state.outcome.winner === HUMAN_SEAT) sounds.win();
      else if (state.outcome.winner === "tie") sounds.push();
      else sounds.lose();
    }
  }, [state.phase, state.outcome, mounted]);

  function toggleMute() {
    const next = !muted;
    sounds.setMuted(next);
    setMutedState(next);
  }

  function clickHandTile(index: number) {
    if (!humansTurn) return;
    const ends = humanLegal.filter((m) => m.index === index).map((m) => m.end);
    if (ends.length === 0) return;
    sounds.chip();
    if (ends.length === 1) {
      play(index, ends[0]);
      setSelected(null);
    } else {
      setSelected((s) => (s === index ? null : index));
    }
  }

  function chooseEnd(end: End) {
    if (selected === null) return;
    sounds.chip();
    play(selected, end);
    setSelected(null);
  }

  function handleDraw() {
    sounds.deal();
    draw();
  }

  if (!mounted) return <div className="dominoes-app" />;

  const myHand = state.hands[HUMAN_SEAT];
  const botCount = state.hands[BOT_SEAT].length;
  const roundOver = state.phase === "roundOver";

  const statusMsg = roundOver
    ? ""
    : humansTurn
      ? (humanMustDraw ? (state.boneyard.length > 0 ? "No legal play — draw a tile" : "No legal play — pass") : "Your turn — play a tile")
      : "Bot is thinking…";

  return (
    <div className="dominoes-app">
      <div className="dapp">
        <header className="dtopbar">
          <div className="dbrand">Dominoes<span>Club</span><i className="dver">v{VERSION}</i></div>
          <div className="dtopbar__actions">
            <button className="dtopbar__btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button className="dtopbar__btn" onClick={() => { setSelected(null); restart(); }}>New game</button>
            <Link className="dtopbar__btn" href="/" style={{ textDecoration: "none" }}>♠ Club</Link>
          </div>
        </header>

        <div className="dstatus">
          <span className="dstatus__boneyard">Boneyard: {state.boneyard.length}</span>
          <span className="dstatus__msg">{statusMsg}</span>
          <span className="dstatus__bot">Bot: {botCount} tiles</span>
        </div>

        <div className="dboard">
          <div className="dboard__backs">{Array.from({ length: botCount }, (_, i) => <TileBack key={i} small />)}</div>
          <div className="dline">
            {state.board.line.map((p, i) => (
              <TileView key={i} tile={p.tile} vertical small={false} />
            ))}
          </div>
        </div>

        {humanMustDraw && !roundOver && (
          <div className="ddraw">
            <button className="dbigbtn" onClick={handleDraw}>
              {state.boneyard.length > 0 ? "Draw a tile" : "Pass"}
            </button>
          </div>
        )}

        {selected !== null && (
          <div className="dendpick">
            <span>Play at which end?</span>
            <button className="dbigbtn dbigbtn--sm" onClick={() => chooseEnd("left")}>◀ Left</button>
            <button className="dbigbtn dbigbtn--sm" onClick={() => chooseEnd("right")}>Right ▶</button>
          </div>
        )}

        <section className="dhand">
          {myHand.map((t, i) => {
            const legal = humanLegal.some((m) => m.index === i);
            return (
              <TileView
                key={i}
                tile={t}
                playable={legal && humansTurn}
                disabled={humansTurn && !legal}
                onClick={humansTurn ? () => clickHandTile(i) : undefined}
              />
            );
          })}
        </section>

        {roundOver && state.outcome && (
          <div className="dmodal">
            <div className="dmodal__card">
              <h2 className="dmodal__title">
                {state.outcome.winner === HUMAN_SEAT && "🏆 You win!"}
                {state.outcome.winner === BOT_SEAT && "Bot wins"}
                {state.outcome.winner === "tie" && "Blocked — it's a tie"}
              </h2>
              <p className="dmodal__sub">
                {state.outcome.kind === "block" ? "The board blocked — lowest pips wins." : "Hand emptied!"}
              </p>
              <div className="dmodal__pips">
                <span>You: {handPips(myHand)} pips left</span>
                <span>Bot: {handPips(state.hands[BOT_SEAT])} pips left</span>
              </div>
              <button className="dbigbtn" onClick={() => { setSelected(null); restart(); }}>New game</button>
            </div>
          </div>
        )}

        <footer className="dfoot">
          Basic Draw Dominoes · double-6 set · heads-up vs the bot ·{" "}
          <Link href="/play">Blackjack ♠♥♦♣</Link>
        </footer>
      </div>
    </div>
  );
}
