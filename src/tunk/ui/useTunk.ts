import { useCallback, useEffect, useRef, useState } from "react";
import { bestMelds } from "../engine/rules";
import { botChooseDiscard, botDecideDraw, botShouldDrop } from "../engine/bots";
import {
  HUMAN_SEAT, dealNextHand, discardCard, dropHand, drawFromDiscard, drawFromStock, newGame,
} from "../engine/game";
import type { GameState, Seat } from "../engine/game";

const BOT_DELAY_MS = 900;

/**
 * Drives the game. The human (seat 0) acts via the returned callbacks; bots
 * act automatically on a delay. Each bot turn is one atomic engine step
 * (drop, draw, or discard) so the two-step draw→discard turn plays out
 * visibly across two timer ticks.
 */
export function useTunk() {
  const [state, setState] = useState<GameState>(() => newGame());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const humansTurn = state.phase === "playing" && state.turn === HUMAN_SEAT && state.awaitingDiscard === null;
  const humanAwaitingDiscard = state.awaitingDiscard === HUMAN_SEAT;
  const humanHand = state.hands[HUMAN_SEAT];
  const humanMeld = bestMelds(humanHand);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (state.phase !== "playing") return;
    const actingSeat = state.awaitingDiscard ?? state.turn;
    if (actingSeat === HUMAN_SEAT) return; // human acts via UI

    timer.current = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "playing") return s;
        const seat = (s.awaitingDiscard ?? s.turn) as Seat;
        if (seat === HUMAN_SEAT) return s;

        if (s.awaitingDiscard === seat) {
          return discardCard(s, seat, botChooseDiscard(s.hands[seat]));
        }
        const mode = botShouldDrop(s, seat);
        if (mode) return dropHand(s, seat, mode);
        const source = botDecideDraw(s, seat);
        return source === "discard" ? drawFromDiscard(s, seat) : drawFromStock(s, seat);
      });
    }, BOT_DELAY_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state]);

  const draw = useCallback((source: "stock" | "discard") => {
    setState((s) => {
      if (s.phase !== "playing" || s.turn !== HUMAN_SEAT || s.awaitingDiscard !== null) return s;
      try { return source === "stock" ? drawFromStock(s, HUMAN_SEAT) : drawFromDiscard(s, HUMAN_SEAT); }
      catch { return s; }
    });
  }, []);

  const discard = useCallback((cardId: number) => {
    setState((s) => {
      if (s.awaitingDiscard !== HUMAN_SEAT) return s;
      try { return discardCard(s, HUMAN_SEAT, cardId); } catch { return s; }
    });
  }, []);

  const drop = useCallback((mode: "tonk" | "drop") => {
    setState((s) => {
      if (s.phase !== "playing" || s.turn !== HUMAN_SEAT || s.awaitingDiscard !== null) return s;
      try { return dropHand(s, HUMAN_SEAT, mode); } catch { return s; }
    });
  }, []);

  const nextHand = useCallback(() => {
    setState((s) => (s.phase === "handComplete" ? dealNextHand(s) : s));
  }, []);

  const restart = useCallback(() => setState(newGame()), []);

  return {
    state, humansTurn, humanAwaitingDiscard, humanHand, humanMeld,
    draw, discard, drop, nextHand, restart,
  };
}
