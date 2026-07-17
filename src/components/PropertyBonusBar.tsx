"use client";

// Vegas property daily bonus — pick one of six property cards once per
// Vegas day for a surprise cash bonus. Alongside (not replacing) the flat
// daily bonus. Deliberately independent of GameTable, same reasoning as
// QuestsBar: this UI should never need the WIP dance.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";

interface PropertySummary {
  id: string;
  name: string;
  tagline: string;
}

interface ClaimResult {
  propertyName: string;
  granted: number;
  bonusHit: boolean;
  bonusLabel: string | null;
}

export function PropertyBonusBar() {
  const [properties, setProperties] = useState<PropertySummary[] | null>(null);
  const [available, setAvailable] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [reveal, setReveal] = useState<ClaimResult | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/property-bonus");
      if (!res.ok) return;
      const data = (await res.json()) as { available: boolean; properties: PropertySummary[] };
      setProperties(data.properties);
      setAvailable(data.available);
    } catch {
      // transient — the bar just stays hidden this load
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function pick(id: string) {
    if (picking) return;
    setPicking(id);
    try {
      const res = await fetch("/api/property-bonus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't claim that bonus");
      setReveal({
        propertyName: data.propertyName,
        granted: data.granted,
        bonusHit: data.bonusHit,
        bonusLabel: data.bonusLabel,
      });
      setAvailable(false);
      sounds.coins();
      toast.success(
        data.bonusHit
          ? `${data.bonusLabel} +${data.granted.toLocaleString()} chips at ${data.propertyName}!`
          : `+${data.granted.toLocaleString()} chips at ${data.propertyName}!`,
        { duration: 6000 }
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPicking(null);
    }
  }

  if (!properties) return null;

  return (
    <div className="mx-auto mb-2 w-full max-w-4xl px-3">
      {!open && !reveal && (
        <button
          onClick={() => setOpen(true)}
          disabled={!available}
          className={`mx-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            available
              ? "gold-ring bg-black/35 text-[var(--gold-bright)] hover:bg-black/50"
              : "cursor-default bg-black/20 text-[var(--cream)]/35"
          }`}
        >
          🎰 {available ? "Pick a Vegas property — daily bonus" : "Property bonus claimed today"}
        </button>
      )}

      {open && !reveal && (
        <div className="rounded-xl border border-[var(--gold)]/20 bg-black/30 p-3">
          <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--cream)]/40">
            Pick one property — today's bonus
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p.id)}
                disabled={picking !== null}
                title={p.tagline}
                className={`w-28 rounded-lg border border-[var(--gold)]/30 bg-black/40 px-2 py-3 text-center transition-transform hover:scale-105 hover:border-[var(--gold)]/70 disabled:opacity-50 ${
                  picking === p.id ? "scale-95 animate-pulse" : ""
                }`}
              >
                <div className="text-lg">🎲</div>
                <div className="mt-1 text-[11px] font-bold text-[var(--gold-bright)]">{p.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {reveal && (
        <div className="mx-auto flex max-w-sm flex-col items-center rounded-xl border border-[var(--gold)]/40 bg-black/40 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--cream)]/40">
            {reveal.propertyName}
          </div>
          {reveal.bonusLabel && (
            <div className="mt-1 text-sm font-bold text-[var(--gold-bright)]">{reveal.bonusLabel}</div>
          )}
          <div className="mt-1 text-xl font-bold text-[var(--gold-bright)]">
            +{reveal.granted.toLocaleString()} chips
          </div>
          <button
            onClick={() => {
              setReveal(null);
              setOpen(false);
            }}
            className="mt-2 text-[10px] uppercase tracking-widest text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
