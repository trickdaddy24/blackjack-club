"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { botChoosePlay } from "../engine/bots";
import { applyDraw, applyPlay, legalMoves, newGame } from "../engine/game";
import type { End, GameState, Seat } from "../engine/types";

export const HUMAN_SEAT: Seat = 0;
const BOT_SEAT: Seat = 1;
const BOT_DELAY_MS = 700; // pause before each bot action, so play is followable

/** Drives the game. The human (seat 0) acts via the returned callbacks; the
 *  bot (seat 1) acts automatically — including drawing repeatedly until it
 *  can play or the boneyard runs out. */
export function useDominoes() {
  const [state, setState] = useState<GameState>(() => newGame());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const humansTurn = state.phase === "playing" && state.turn === HUMAN_SEAT;
  const humanLegal = legalMoves(state.hands[HUMAN_SEAT], state.board);
  const humanMustDraw = humansTurn && humanLegal.length === 0;

  // Advance the bot: play its best legal tile, or draw one (which may need
  // to repeat — each draw re-triggers this effect since state changes).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (state.phase !== "playing" || state.turn !== BOT_SEAT) return;

    timer.current = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "playing" || s.turn !== BOT_SEAT) return s;
        const choice = botChoosePlay(s.hands[BOT_SEAT], s.board);
        if (choice) return applyPlay(s, BOT_SEAT, choice.index, choice.end);
        return applyDraw(s, BOT_SEAT);
      });
    }, BOT_DELAY_MS);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [state]);

  const play = useCallback((tileIndex: number, end: End) => {
    setState((s) => (s.turn === HUMAN_SEAT && s.phase === "playing" ? applyPlay(s, HUMAN_SEAT, tileIndex, end) : s));
  }, []);

  const draw = useCallback(() => {
    setState((s) => (s.turn === HUMAN_SEAT && s.phase === "playing" ? applyDraw(s, HUMAN_SEAT) : s));
  }, []);

  const restart = useCallback(() => {
    setState(newGame());
  }, []);

  return { state, humansTurn, humanLegal, humanMustDraw, play, draw, restart };
}
