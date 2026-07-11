"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearBets, newGame, placeBet, rebet, resolveSpin, setChip as setChipFn,
  switchWheel, totalStaked, undo,
} from "../engine/game";
import { buildBetSpots } from "../engine/table";
import { pocketIndex, spin } from "../engine/wheel";
import type { BetSpot, GameState, PocketId, WheelKind } from "../engine/types";

const STORAGE_KEY = "roulette-club:v1";

interface Persisted {
  wheel: WheelKind;
  balance: number;
  chip: number;
  history: PocketId[];
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Persisted;
      const g = newGame(p.wheel === "american" ? "american" : "european", p.balance ?? 1000);
      return { ...g, chip: p.chip ?? 5, history: p.history ?? [] };
    }
  } catch { /* fall through to a fresh game */ }
  return newGame("european");
}

/**
 * Drives roulette: bet placement, the wheel spin animation, and settlement.
 * The pocket is chosen up front so the wheel can animate to it; settlement is
 * applied only when the animation reports done (onSpinDone).
 */
export function useRoulette() {
  const [state, setState] = useState<GameState>(load);
  // Bumped each spin to re-trigger the wheel animation; carries the target.
  const [spinId, setSpinId] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const pendingPocket = useRef<PocketId | null>(null);

  const spots = useMemo(() => buildBetSpots(state.wheel), [state.wheel]);

  // Persist the durable bits.
  useEffect(() => {
    const p: Persisted = {
      wheel: state.wheel, balance: state.balance, chip: state.chip, history: state.history,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  }, [state.wheel, state.balance, state.chip, state.history]);

  const place = useCallback((spot: BetSpot) => {
    setState((s) => placeBet(s, spot));
  }, []);

  const doUndo = useCallback(() => setState((s) => undo(s)), []);
  const doClear = useCallback(() => setState((s) => clearBets(s)), []);
  const doRebet = useCallback(() => setState((s) => rebet(s)), []);
  const setChip = useCallback((chip: number) => setState((s) => setChipFn(s, chip)), []);
  const setWheel = useCallback((wheel: WheelKind) => {
    setState((s) => (s.spinning ? s : switchWheel(s, wheel)));
  }, []);

  const doSpin = useCallback(() => {
    setState((s) => {
      if (s.spinning || Object.keys(s.bets).length === 0) return s;
      const pocket = spin(s.wheel);
      pendingPocket.current = pocket;
      setTargetIndex(pocketIndex(s.wheel, pocket));
      setSpinId((n) => n + 1);
      return { ...s, spinning: true, lastResult: null };
    });
  }, []);

  // Called by the wheel when its animation finishes landing on the target.
  const onSpinDone = useCallback(() => {
    const pocket = pendingPocket.current;
    if (pocket == null) return;
    pendingPocket.current = null;
    setState((s) => resolveSpin(s, pocket));
  }, []);

  const resetBankroll = useCallback(() => {
    setState((s) => (s.spinning ? s : { ...newGame(s.wheel), chip: s.chip }));
  }, []);

  return {
    state,
    spots,
    staked: totalStaked(state),
    spinId,
    targetIndex,
    place,
    undo: doUndo,
    clear: doClear,
    rebet: doRebet,
    setChip,
    setWheel,
    spin: doSpin,
    onSpinDone,
    resetBankroll,
  };
}
