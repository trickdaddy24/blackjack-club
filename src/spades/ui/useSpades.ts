"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card } from "../engine/cards";
import { botBid, botPlay } from "../engine/bots";
import { HUMAN_SEAT, dealNextHand, newGame, placeBid, playCard } from "../engine/game";
import type { Bid, GameState, PlayedCard, Seat } from "../engine/types";

const BOT_DELAY_MS = 600;   // pause before each bot acts, so play is followable
const TRICK_HOLD_MS = 1100; // hold a completed 4-card trick on screen before clearing

/**
 * Drives the game. The human (seat 0) acts via the returned callbacks; the three
 * bots act automatically on a delay. Because the engine resolves a trick the
 * instant the 4th card is played, this hook holds that completed trick on screen
 * for a beat (TRICK_HOLD_MS) before letting play resume — otherwise tricks would
 * vanish faster than the eye can follow.
 */
export function useSpades() {
  const [state, setState] = useState<GameState>(() => newGame());
  // The trick most recently completed, shown during the hold. null when idle.
  const [heldTrick, setHeldTrick] = useState<{ cards: PlayedCard[]; winner: Seat } | null>(null);
  const holding = heldTrick !== null;

  const prevCompleted = useRef(0);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const humansTurn = !holding
    && state.turn === HUMAN_SEAT
    && (state.phase === "bidding" || state.phase === "playing");

  // Detect a trick that just completed → start the hold.
  useEffect(() => {
    const count = state.completedTricks.length;
    if (count > prevCompleted.current && state.phase !== "handComplete" && state.phase !== "gameOver") {
      const last = state.completedTricks[count - 1];
      // Winner is whoever now leads (engine set turn = trick winner).
      setHeldTrick({ cards: last, winner: state.turn as Seat });
      if (holdTimer.current) clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(() => setHeldTrick(null), TRICK_HOLD_MS);
    }
    prevCompleted.current = count;
  }, [state]);

  // Reset the completed-trick counter when a fresh hand is dealt.
  useEffect(() => {
    if (state.completedTricks.length === 0) prevCompleted.current = 0;
  }, [state.handNumber, state.completedTricks.length]);

  // Advance bots — but never while a completed trick is being held.
  useEffect(() => {
    if (botTimer.current) clearTimeout(botTimer.current);
    if (holding) return;
    if (state.turn === HUMAN_SEAT) return;

    if (state.phase === "bidding") {
      const seat = state.turn as Seat;
      botTimer.current = setTimeout(() => {
        setState((s) => (s.turn === seat && s.phase === "bidding" && !heldTrick
          ? placeBid(s, seat, botBid(s.hands[seat])) : s));
      }, BOT_DELAY_MS);
    } else if (state.phase === "playing") {
      const seat = state.turn as Seat;
      botTimer.current = setTimeout(() => {
        setState((s) => (s.turn === seat && s.phase === "playing"
          ? playCard(s, seat, botPlay(s, seat)) : s));
      }, BOT_DELAY_MS);
    }
    return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, [state, holding, heldTrick]);

  const bid = useCallback((b: Bid) => {
    setState((s) => (s.turn === HUMAN_SEAT && s.phase === "bidding" ? placeBid(s, HUMAN_SEAT, b) : s));
  }, []);

  const play = useCallback((card: Card) => {
    if (heldTrick) return;
    setState((s) => (s.turn === HUMAN_SEAT && s.phase === "playing" ? playCard(s, HUMAN_SEAT, card) : s));
  }, [heldTrick]);

  const nextHand = useCallback(() => {
    setHeldTrick(null);
    setState((s) => (s.phase === "handComplete" ? dealNextHand(s) : s));
  }, []);

  const restart = useCallback(() => {
    setHeldTrick(null);
    prevCompleted.current = 0;
    setState(newGame());
  }, []);

  // What to render in the trick area: the held trick during a hold, else live.
  const displayTrick = heldTrick ? heldTrick.cards : state.currentTrick;
  const trickWinnerSeat = heldTrick?.winner ?? null;

  return { state, humansTurn, holding, displayTrick, trickWinnerSeat, bid, play, nextHand, restart };
}
