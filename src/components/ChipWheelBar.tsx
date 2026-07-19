"use client";

// Chip wheel — a free daily spin, weighted toward small payouts with one
// rare jackpot slice. Unlike the property bonus (pick a card), there's no
// choice here: the server rolls first, then the wheel animates to land on
// whatever it already decided — same server-authoritative-then-animate
// pattern as the Roulette wheel this component's animation was adapted from.
// Deliberately independent of GameTable, same reasoning as the other bars.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";
import { ChipWheel } from "./ChipWheel";

interface Segment {
  value: number;
  jackpot: boolean;
}

interface SpinResult {
  granted: number;
  jackpot: boolean;
  segmentIndex: number;
}

export function ChipWheelBar() {
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinId, setSpinId] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [pending, setPending] = useState<SpinResult | null>(null);
  const [reveal, setReveal] = useState<SpinResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chip-wheel");
      if (!res.ok) return;
      const data = (await res.json()) as { available: boolean; segments: Segment[] };
      setSegments(data.segments);
      setAvailable(data.available);
    } catch {
      // transient — the bar just stays hidden this load
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function spin() {
    if (spinning || !available) return;
    setSpinning(true);
    try {
      const res = await fetch("/api/chip-wheel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't spin the wheel");
      setPending({ granted: data.granted, jackpot: data.jackpot, segmentIndex: data.segmentIndex });
      setTargetIndex(data.segmentIndex);
      setSpinId((n) => n + 1);
      setAvailable(false);
      sounds.shuffle();
    } catch (e) {
      toast.error((e as Error).message);
      setSpinning(false);
    }
  }

  function onSpinDone() {
    setSpinning(false);
    if (!pending) return;
    setReveal(pending);
    setPending(null);
    sounds.coins();
    toast.success(
      pending.jackpot
        ? `★ JACKPOT! +${pending.granted.toLocaleString()} chips!`
        : `+${pending.granted.toLocaleString()} chips!`,
      { duration: 6000 }
    );
  }

  if (!segments) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-4xl px-3">
      {!open && (
        <button
          onClick={() => setOpen(true)}
          disabled={!available}
          className={`mx-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            available
              ? "gold-ring bg-black/35 text-[var(--gold-bright)] hover:bg-black/50"
              : "cursor-default bg-black/20 text-[var(--cream)]/35"
          }`}
        >
          🎡 {available ? "Spin the Chip Wheel — daily bonus" : "Chip wheel spun today"}
        </button>
      )}

      {open && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--gold)]/20 bg-black/30 p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--cream)]/40">
            Today's free spin
          </div>
          <ChipWheel segments={segments} spinId={spinId} targetIndex={targetIndex} onDone={onSpinDone} />
          {reveal ? (
            <div className="flex flex-col items-center gap-1 text-center">
              {reveal.jackpot && (
                <div className="text-sm font-bold text-[var(--gold-bright)]">★ JACKPOT!</div>
              )}
              <div className="text-xl font-bold text-[var(--gold-bright)]">
                +{reveal.granted.toLocaleString()} chips
              </div>
              <button
                onClick={() => { setReveal(null); setOpen(false); }}
                className="mt-1 text-[10px] uppercase tracking-widest text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <button
              onClick={spin}
              disabled={spinning || !available}
              className="action-btn primary !px-8 !py-2 !text-sm"
            >
              {spinning ? "Spinning…" : "Spin"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
