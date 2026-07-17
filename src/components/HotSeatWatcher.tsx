"use client";

// Hot Seat watcher: polls fleet-wide (any page, not just the table) so the
// drop clock keeps advancing and every logged-in player hears about it —
// a big toast for the winner, a social-proof nudge for everyone else.

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";

interface HotSeatState {
  winnerId: string | null;
  winnerName: string | null;
  amount: number | null;
  awardedAt: string | null;
}

const SEEN_KEY = "bj-hotseat-seen";

export function HotSeatWatcher({ userId }: { userId: string }) {
  const seen = useRef<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/hotseat");
      if (!res.ok) return;
      const data = (await res.json()) as HotSeatState;
      if (!data.awardedAt || data.awardedAt === seen.current) return;
      seen.current = data.awardedAt;
      localStorage.setItem(SEEN_KEY, data.awardedAt);

      if (data.winnerId === userId) {
        sounds.coins();
        toast.success(`🔥 HOT SEAT! You just caught +${data.amount?.toLocaleString()} chips!`, {
          duration: 6000,
        });
      } else {
        toast(`🔥 ${data.winnerName} just caught the Hot Seat — +${data.amount?.toLocaleString()} chips!`, {
          duration: 4000,
        });
      }
    } catch {
      // network blip — next poll retries
    }
  }, [userId]);

  useEffect(() => {
    seen.current = localStorage.getItem(SEEN_KEY);
    void poll();
    const t = setInterval(poll, 8_000);
    return () => clearInterval(t);
  }, [poll]);

  return null;
}
