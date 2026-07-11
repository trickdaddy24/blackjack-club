"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Card, Color } from "../engine/cards";
import { isWild } from "../engine/cards";
import { botChooseColor, botPlay } from "../engine/bots";
import {
  HUMAN_SEAT, dealNextHand, drawCard, keepDrawn, newGame, playCard, playDrawn,
} from "../engine/game";
import type { GameState, Seat } from "../engine/game";

const BOT_DELAY_MS = 850; // pause before each bot acts, so play is followable

/**
 * Drives the game. The human (seat 0) acts via the returned callbacks; the
 * three bots act automatically on a delay. Wilds from the human go through a
 * pending state while the color picker is open.
 */
export function useWildcard() {
  const [state, setState] = useState<GameState>(() => newGame());
  // A human wild waiting on the color picker (cardId + whether it was the drawn card).
  const [pendingWild, setPendingWild] = useState<{ cardId: number; fromDrawn: boolean } | null>(null);
  // "Last card!" declaration toggle — armed by the player before going to 1 card.
  const [declareArmed, setDeclareArmed] = useState(false);

  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const humansTurn = state.phase === "playing" && state.turn === HUMAN_SEAT;
  const humanDrawnPending = state.drawn?.seat === HUMAN_SEAT ? state.drawn : null;

  // Reset the declare toggle whenever a new hand starts.
  useEffect(() => { setDeclareArmed(false); }, [state.handNumber]);

  // Advance bots.
  useEffect(() => {
    if (botTimer.current) clearTimeout(botTimer.current);
    if (state.phase !== "playing") return;
    if (state.turn === HUMAN_SEAT) return;

    const seat = state.turn as Seat;
    botTimer.current = setTimeout(() => {
      setState((s) => {
        if (s.phase !== "playing" || s.turn !== seat) return s;
        const mv = botPlay(s, seat);
        if (mv) {
          return playCard(s, seat, mv.card.id, {
            chosenColor: mv.chosenColor, declareLast: true,
          });
        }
        const after = drawCard(s, seat);
        if (after.drawn?.seat === seat) {
          const d = after.hands[seat].find((c) => c.id === after.drawn!.cardId)!;
          return playDrawn(after, seat, {
            chosenColor: isWild(d) ? botChooseColor(after.hands[seat].filter((c) => c.id !== d.id)) : undefined,
            declareLast: true,
          });
        }
        return after;
      });
    }, BOT_DELAY_MS);
    return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, [state]);

  /** Human clicks a card. Wilds open the color picker; the rest play at once. */
  const play = useCallback((card: Card) => {
    if (isWild(card)) { setPendingWild({ cardId: card.id, fromDrawn: false }); return; }
    setState((s) => {
      if (s.phase !== "playing" || s.turn !== HUMAN_SEAT) return s;
      try { return playCard(s, HUMAN_SEAT, card.id, { declareLast: declareArmed }); }
      catch { return s; }
    });
    setDeclareArmed(false);
  }, [declareArmed]);

  /** Color picked for a pending human wild. */
  const pickColor = useCallback((color: Color) => {
    setPendingWild((pw) => {
      if (!pw) return null;
      setState((s) => {
        if (s.phase !== "playing" || s.turn !== HUMAN_SEAT) return s;
        try {
          return pw.fromDrawn
            ? playDrawn(s, HUMAN_SEAT, { chosenColor: color, declareLast: declareArmed })
            : playCard(s, HUMAN_SEAT, pw.cardId, { chosenColor: color, declareLast: declareArmed });
        } catch { return s; }
      });
      setDeclareArmed(false);
      return null;
    });
  }, [declareArmed]);

  const cancelWild = useCallback(() => setPendingWild(null), []);

  const draw = useCallback(() => {
    setState((s) => {
      if (s.phase !== "playing" || s.turn !== HUMAN_SEAT || s.drawn) return s;
      return drawCard(s, HUMAN_SEAT);
    });
  }, []);

  const playTheDrawn = useCallback(() => {
    setState((s) => {
      if (s.drawn?.seat !== HUMAN_SEAT) return s;
      const d = s.hands[HUMAN_SEAT].find((c) => c.id === s.drawn!.cardId)!;
      if (isWild(d)) {
        setPendingWild({ cardId: d.id, fromDrawn: true });
        return s;
      }
      try { return playDrawn(s, HUMAN_SEAT, { declareLast: declareArmed }); }
      catch { return s; }
    });
    setDeclareArmed(false);
  }, [declareArmed]);

  const keepTheDrawn = useCallback(() => {
    setState((s) => (s.drawn?.seat === HUMAN_SEAT ? keepDrawn(s, HUMAN_SEAT) : s));
  }, []);

  const nextHand = useCallback(() => {
    setState((s) => (s.phase === "handComplete" ? dealNextHand(s) : s));
  }, []);

  const restart = useCallback(() => {
    setPendingWild(null);
    setDeclareArmed(false);
    setState(newGame());
  }, []);

  return {
    state, humansTurn, humanDrawnPending, pendingWild, declareArmed,
    play, pickColor, cancelWild, draw, playTheDrawn, keepTheDrawn,
    setDeclareArmed, nextHand, restart,
  };
}
