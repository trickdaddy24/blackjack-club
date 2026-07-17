"use client";

// Counting Gym — speed-flash drills. The server issues the cards and holds
// the truth; this component is the projector and the answer sheet.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Dumbbell, Minus, Plus } from "lucide-react";
import type { Card } from "@/lib/blackjack/engine";
import { GYM_LEVELS } from "@/lib/gym";
import { PlayingCard } from "@/components/PlayingCard";
import { sounds } from "@/lib/sound";

interface GymStats {
  total: number;
  perfect: number;
  accuracy: number | null;
  bestLevel: string | null;
}

interface UnlockedAchievement {
  slug: string;
  name: string;
  emoji: string;
  description: string;
}

type Phase = "pick" | "flashing" | "answer" | "result";

export function CountingGym({ stats }: { stats: GymStats }) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [levelId, setLevelId] = useState("regular");
  const [drillId, setDrillId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [speedMs, setSpeedMs] = useState(1000);
  const [shown, setShown] = useState(-1);
  const [guess, setGuess] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; actual: number; submitted: number; reward?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/gym/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the drill");
      setLevelId(id);
      setDrillId(data.drillId);
      setCards(data.cards);
      setSpeedMs(data.speedMs);
      setGuess(0);
      setResult(null);
      setShown(-1);
      setPhase("flashing");
      let i = -1;
      timer.current = setInterval(() => {
        i += 1;
        if (i >= data.cards.length) {
          if (timer.current) clearInterval(timer.current);
          setPhase("answer");
          return;
        }
        setShown(i);
        if (data.speedMs >= 500) sounds.deal();
      }, data.speedMs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!drillId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gym/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drillId, answer: guess }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't grade the drill");
      setResult(data);
      setPhase("result");
      if (data.correct) {
        sounds.win();
        if (data.reward) sounds.coins(0.6);
      } else {
        sounds.push();
      }
      (data.unlocked as UnlockedAchievement[] | undefined)?.forEach((a, i) =>
        setTimeout(
          () =>
            toast.success(`${a.emoji} Achievement unlocked — ${a.name}`, {
              description: a.description,
              duration: 9000,
            }),
          800 + i * 700
        )
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const level = GYM_LEVELS.find((l) => l.id === levelId)!;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">
      <div className="fade-up mt-8 text-center">
        <h1 className="flex items-center justify-center gap-2 font-display text-3xl font-bold tracking-wide gold-text">
          <Dumbbell className="h-7 w-7" /> Counting Gym
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--cream)]/60">
          Cards flash from a fresh 6-deck shoe. Keep the Hi-Lo count (2–6 = +1,
          10s &amp; aces = −1) and call it at the end. First perfect drill each
          day pays 250 chips.
        </p>
      </div>

      {/* lifetime stats strip */}
      <div className="fade-up mx-auto mt-5 flex max-w-md items-center justify-center gap-4 rounded-full gold-ring bg-black/30 px-5 py-2 text-xs text-[var(--cream)]/60" style={{ animationDelay: "60ms" }}>
        <span>{stats.total.toLocaleString()} drills</span>
        <span>·</span>
        <span>{stats.accuracy !== null ? `${stats.accuracy}% perfect` : "no reps yet"}</span>
        {stats.bestLevel && (
          <>
            <span>·</span>
            <span className="text-[var(--gold-bright)]">best: {stats.bestLevel}</span>
          </>
        )}
      </div>

      {phase === "pick" && (
        <div className="fade-up mt-8 grid gap-3 sm:grid-cols-5" style={{ animationDelay: "120ms" }}>
          {GYM_LEVELS.map((l) => (
            <button
              key={l.id}
              disabled={busy}
              onClick={() => start(l.id)}
              className="gold-ring rounded-2xl bg-black/25 px-3 py-5 text-center transition-colors hover:bg-[var(--gold)]/10"
            >
              <div className="text-2xl">{l.emoji}</div>
              <div className="mt-1 font-display font-bold gold-text">{l.name}</div>
              <div className="mt-1 text-[11px] text-[var(--cream)]/50">
                {l.cards} cards · {(l.speedMs / 1000).toFixed(2)}s each
              </div>
            </button>
          ))}
        </div>
      )}

      {phase === "flashing" && (
        <div className="mt-10 flex flex-col items-center gap-5">
          <div className="flex h-40 items-center justify-center">
            {shown >= 0 && shown < cards.length && (
              <div key={shown} className="scale-150">
                <PlayingCard card={cards[shown]} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i <= shown ? "bg-[var(--gold)]" : "bg-white/15"}`}
              />
            ))}
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--cream)]/40">
            {level.name} · card {Math.min(shown + 1, cards.length)} of {cards.length}
          </p>
        </div>
      )}

      {phase === "answer" && (
        <div className="fade-up mt-10 flex flex-col items-center gap-4">
          <p className="font-display text-xl font-bold gold-text">What&apos;s the running count?</p>
          <div className="flex items-center gap-3">
            <button
              className="gold-ring flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-[var(--cream)] hover:bg-[var(--gold)]/15"
              onClick={() => setGuess((g) => g - 1)}
              aria-label="Minus one"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={guess}
              onChange={(e) => setGuess(Math.trunc(Number(e.target.value) || 0))}
              className="w-24 rounded-xl border border-[var(--gold)]/30 bg-black/40 px-3 py-2.5 text-center font-display text-2xl font-bold text-[var(--cream)] focus:border-[var(--gold)]/70 focus:outline-none"
              aria-label="Your running count"
            />
            <button
              className="gold-ring flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-[var(--cream)] hover:bg-[var(--gold)]/15"
              onClick={() => setGuess((g) => g + 1)}
              aria-label="Plus one"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button className="action-btn primary !px-10" onClick={submit} disabled={busy}>
            Lock It In
          </button>
        </div>
      )}

      {phase === "result" && result && (
        <div className="fade-up mt-10 flex flex-col items-center gap-3 text-center">
          <div className="font-display text-4xl font-black tracking-wide">
            {result.correct ? (
              <span className="gold-text">DEAD ON 🎯</span>
            ) : (
              <span className="text-red-300/90">OFF THE COUNT</span>
            )}
          </div>
          <p className="text-sm text-[var(--cream)]/70 tabular-nums">
            You said <strong>{result.submitted > 0 ? `+${result.submitted}` : result.submitted}</strong>
            {" — the shoe was "}
            <strong>{result.actual > 0 ? `+${result.actual}` : result.actual}</strong>
          </p>
          {result.reward && (
            <p className="rounded-full bg-[var(--gold)]/15 px-4 py-1 text-sm font-bold text-[var(--gold-bright)]">
              First perfect of the day: +{result.reward} chips
            </p>
          )}
          <div className="mt-2 flex gap-3">
            <button className="action-btn" onClick={() => setPhase("pick")}>
              Change Level
            </button>
            <button className="action-btn primary" onClick={() => start(levelId)} disabled={busy}>
              Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
