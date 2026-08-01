"use client";

// Today's quests, above the felt. Polls /api/quests (6s while visible) and
// toasts completions client-side — deliberately independent of GameTable so
// quest UI never touches the WIP-heavy table component.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";
import { emitChipsChanged } from "@/lib/chip-events";

interface QuestState {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  target: number;
  reward: number;
  progress: number;
  done: boolean;
}

interface CleanSweepState {
  name: string;
  emoji: string;
  description: string;
  reward: number;
  claimed: boolean;
  streak: number;
}

export function QuestsBar() {
  const [quests, setQuests] = useState<QuestState[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [sweep, setSweep] = useState<CleanSweepState | null>(null);
  const known = useRef<Map<string, boolean>>(new Map());
  const sweepKnown = useRef<boolean | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/quests");
      if (!res.ok) return;
      const data = (await res.json()) as {
        quests: QuestState[];
        loginStreak: number;
        cleanSweep?: CleanSweepState;
      };
      for (const q of data.quests) {
        const was = known.current.get(q.slug);
        if (was === false && q.done) {
          sounds.coins(0.1);
          emitChipsChanged("quest", q.reward);
          toast.success(`${q.emoji} Quest complete — ${q.name}`, {
            description: `+${q.reward.toLocaleString()} chips`,
            duration: 8000,
          });
        }
        known.current.set(q.slug, q.done);
      }
      // Clean Sweep lands after the third quest's own toast; announce it
      // separately so the bonus doesn't get lost behind that one.
      if (data.cleanSweep) {
        const wasSwept = sweepKnown.current;
        if (wasSwept === false && data.cleanSweep.claimed) {
          // Louder than a single quest's `coins` — this is the day's payoff.
          sounds.blackjack(0);
          sounds.coins(0.35);
          emitChipsChanged("clean-sweep", data.cleanSweep.reward);
          toast.success(`${data.cleanSweep.emoji} Clean Sweep!`, {
            description:
              `All three quests done — +${data.cleanSweep.reward.toLocaleString()} chips` +
              (data.cleanSweep.streak > 1 ? ` · ${data.cleanSweep.streak}-day sweep streak` : ""),
            duration: 10000,
          });
        }
        sweepKnown.current = data.cleanSweep.claimed;
        setSweep(data.cleanSweep);
      }
      setQuests(data.quests);
      setStreak(data.loginStreak);
    } catch {
      // transient — next poll retries
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 6000);
    return () => clearInterval(t);
  }, [poll]);

  if (!quests) return null;

  return (
    <div className="mx-auto mb-2 flex w-full max-w-4xl flex-wrap items-center justify-center gap-2 px-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--cream)]/40">
        Daily quests
      </span>
      {quests.map((q) => (
        <div
          key={q.slug}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
            q.done
              ? "bg-[var(--gold)]/20 text-[var(--gold-bright)]"
              : "bg-black/35 text-[var(--cream)]/65 gold-ring"
          }`}
          title={`${q.description} Reward: ${q.reward.toLocaleString()} chips.`}
        >
          <span>{q.emoji}</span>
          <span className="font-semibold">{q.name}</span>
          {q.done ? (
            <span className="font-bold">✓ +{q.reward.toLocaleString()}</span>
          ) : (
            <>
              <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-black/60">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--gold)]/80 transition-all duration-500"
                  style={{ width: `${(q.progress / q.target) * 100}%` }}
                />
              </span>
              <span className="font-mono tabular-nums">
                {q.progress}/{q.target}
              </span>
            </>
          )}
        </div>
      ))}
      {sweep && (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            sweep.claimed
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-white/5 text-[var(--cream)]/45"
          }`}
          title={
            sweep.claimed
              ? `${sweep.description} Paid +${sweep.reward.toLocaleString()} chips today.`
              : `${sweep.description} Worth +${sweep.reward.toLocaleString()} chips.`
          }
        >
          {sweep.emoji} {sweep.claimed ? "Clean Sweep" : `Sweep +${sweep.reward.toLocaleString()}`}
          {sweep.streak > 1 && (
            <span className="ml-1 opacity-80">· {sweep.streak}d</span>
          )}
        </span>
      )}
      {streak > 1 && (
        <span
          className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200"
          title="Claim your daily bonus on consecutive days to grow the boost (+250/day, up to +1,750)"
        >
          🔥 day {streak} streak
        </span>
      )}
    </div>
  );
}
