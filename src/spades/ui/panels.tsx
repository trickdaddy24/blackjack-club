"use client";

import { useRef, useState } from "react";
import type { Bid, GameState, HandResult, Seat } from "../engine/types";
import { teamOf } from "../engine/types";

export const SEAT_NAME: Record<Seat, string> = { 0: "You", 1: "West", 2: "North", 3: "East" };
export const PARTNER: Record<Seat, string> = { 0: "North", 1: "East", 2: "You", 3: "West" };

function bidLabel(b: Bid | null): string {
  if (!b) return "—";
  if (b.tricks === 0) return b.blind ? "Blind Nil" : "Nil";
  return String(b.tricks);
}

/** The bidding control. Draggable by its header so it can be pulled off your
 * cards while you decide the bid. Starts docked at the bottom (translateX(-50%)
 * from CSS); dragging adds a pixel offset on top of that. */
export function BidPanel({ onBid, canBlindNil }: { onBid: (b: Bid) => void; canBlindNil: boolean }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    const base = pos ?? { x: 0, y: 0 };
    drag.current = { sx: e.clientX, sy: e.clientY, ox: base.x, oy: base.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    });
  };
  const onUp = () => { drag.current = null; };

  // Default docked position uses translateX(-50%); a drag adds an offset.
  const style = pos
    ? { transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)` }
    : undefined;

  return (
    <div className="bidpanel" style={style}>
      <div
        className="bidpanel__drag"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className="bidpanel__grip">⠿</span> Your bid <span className="bidpanel__draghint">drag to move</span>
      </div>
      <div className="bidpanel__row">
        <button className="bidbtn bidbtn--nil" onClick={() => onBid({ tricks: 0, blind: false })}>
          Nil
        </button>
        {canBlindNil && (
          <button className="bidbtn bidbtn--blind" onClick={() => onBid({ tricks: 0, blind: true })}>
            Blind Nil
          </button>
        )}
      </div>
      <div className="bidpanel__grid">
        {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
          <button key={n} className="bidbtn" onClick={() => onBid({ tricks: n, blind: false })}>
            {n}
          </button>
        ))}
      </div>
      <p className="bidpanel__hint">
        Nil = take zero tricks for +100. Bags (overtricks) sting: −100 at 10.
      </p>
    </div>
  );
}

/** Per-seat status chip: name, bid, tricks taken so far. */
export function SeatBadge({ state, seat, active }: { state: GameState; seat: Seat; active: boolean }) {
  const team = teamOf(seat);
  return (
    <div className={`seat seat--t${team} ${active ? "seat--active" : ""}`}>
      <div className="seat__name">{SEAT_NAME[seat]}</div>
      <div className="seat__stat">
        <span className="seat__bid">bid {bidLabel(state.bids[seat])}</span>
        <span className="seat__won">{state.tricksWon[seat]} won</span>
      </div>
    </div>
  );
}

export function Scoreboard({ state }: { state: GameState }) {
  const t = state.teamScores;
  return (
    <div className="scoreboard">
      <div className="score score--t0">
        <div className="score__team">You + North</div>
        <div className="score__pts">{t[0].score}</div>
        <div className="score__bags">🎒 {t[0].bags}</div>
      </div>
      <div className="score__target">to {state.targetScore}</div>
      <div className="score score--t1">
        <div className="score__team">West + East</div>
        <div className="score__pts">{t[1].score}</div>
        <div className="score__bags">🎒 {t[1].bags}</div>
      </div>
    </div>
  );
}

/** Hand-over breakdown modal. */
export function HandResultPanel({
  result, state, onNext, onRestart,
}: {
  result: HandResult;
  state: GameState;
  onNext: () => void;
  onRestart: () => void;
}) {
  const gameOver = state.phase === "gameOver";
  const [teamA, teamB] = result.teams;
  const names = ["You + North", "West + East"];

  return (
    <div className="modal">
      <div className="modal__card">
        <h2 className="modal__title">
          {gameOver
            ? (state.winner === 0 ? "🏆 You win the game!" : "West + East win the game")
            : `Hand ${result.handNumber} complete`}
        </h2>
        <div className="resultgrid">
          {[teamA, teamB].map((tr, i) => (
            <div key={i} className={`resultcol resultcol--t${i}`}>
              <div className="resultcol__team">{names[i]}</div>
              <div className="resultcol__line">bid {tr.bidTotal} · took {tr.tricks}</div>
              {tr.nilResults.map((n, j) => (
                <div key={j} className={`resultcol__nil ${n.made ? "ok" : "bad"}`}>
                  {SEAT_NAME[n.seat]} {n.bid.blind ? "Blind Nil" : "Nil"}: {n.made ? "made" : "failed"} {n.points > 0 ? "+" : ""}{n.points}
                </div>
              ))}
              {tr.bagPenalty !== 0 && <div className="resultcol__bag">bag penalty {tr.bagPenalty}</div>}
              <div className={`resultcol__pts ${tr.points >= 0 ? "ok" : "bad"}`}>
                {tr.points >= 0 ? "+" : ""}{tr.points}
              </div>
              <div className="resultcol__total">total {state.teamScores[i].score}</div>
            </div>
          ))}
        </div>
        {gameOver
          ? <button className="bigbtn" onClick={onRestart}>New game</button>
          : <button className="bigbtn" onClick={onNext}>Deal next hand</button>}
      </div>
    </div>
  );
}

/** A tiny confirm on Blind Nil, since it commits before seeing the hand. */
export function useBlindNilGuard() {
  const [pending, setPending] = useState(false);
  return { pending, setPending };
}
