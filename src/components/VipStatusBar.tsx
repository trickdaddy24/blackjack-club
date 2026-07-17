"use client";

// VIP tier status, above the felt. Polls /api/vip (20s while on /play) —
// that GET is also what lazily claims a tier-up the instant lifetime
// rounds cross a threshold. Deliberately independent of GameTable.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";

interface VipState {
  tier: { name: string; badge: string; dailyBonusBoostPct: number };
  next: { name: string; badge: string; threshold: number } | null;
  roundsPlayed: number;
  tieredUp: boolean;
  bonusAwarded: number;
}

export function VipStatusBar() {
  const [vip, setVip] = useState<VipState | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/vip");
      if (!res.ok) return;
      const data = (await res.json()) as VipState;
      setVip(data);
      if (data.tieredUp) {
        sounds.coins();
        toast.success(
          `${data.tier.badge} ${data.tier.name.toUpperCase()} VIP! +${data.bonusAwarded.toLocaleString()} chips — new perks unlocked`,
          { duration: 8000 }
        );
      }
    } catch {
      // transient — next poll retries
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 20_000);
    return () => clearInterval(t);
  }, [poll]);

  if (!vip) return null;

  return (
    <div className="mx-auto mb-2 flex w-full max-w-4xl items-center justify-center gap-2 px-3">
      <span
        className="flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold text-[var(--gold-bright)] gold-ring"
        title={
          vip.tier.dailyBonusBoostPct > 0
            ? `+${vip.tier.dailyBonusBoostPct}% on your daily bonus`
            : "Play more rounds to earn VIP status"
        }
      >
        <span>{vip.tier.badge}</span>
        <span className="uppercase tracking-wider">{vip.tier.name} VIP</span>
        {vip.next ? (
          <span className="font-mono tabular-nums text-[var(--cream)]/50">
            · {vip.roundsPlayed}/{vip.next.threshold} to {vip.next.badge} {vip.next.name}
          </span>
        ) : (
          <span className="text-[var(--cream)]/50">· max tier</span>
        )}
      </span>
    </div>
  );
}
