"use client";

// Match-play voucher: fleet-wide countdown badge in TopBar, same reasoning
// as HotSeatWatcher — the urgency only works if it's visible everywhere,
// not just on /play. Consumption itself happens server-side inside the
// bet/action settle routes; this badge infers "it just got used" when the
// window disappears earlier than its own expiry, so it can toast without
// GameTable ever needing to know vouchers exist.

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { sounds } from "@/lib/sound";

interface VoucherState {
  active: boolean;
  expiresAt: string | null;
  justGranted: boolean;
}

export function VoucherBadge() {
  const [state, setState] = useState<VoucherState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prevExpiresAt = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/voucher");
      if (!res.ok) return;
      const data = (await res.json()) as VoucherState;

      if (data.justGranted) {
        sounds.coins(0.1);
        toast.success("🎟️ Welcome back — double your next win for the next 2 hours!", {
          duration: 8000,
        });
      } else if (
        !data.active &&
        prevExpiresAt.current !== null &&
        Date.now() < prevExpiresAt.current
      ) {
        // It was active, still had time left, and now it's gone — used, not expired.
        toast("🎟️ Voucher used on that win!", { duration: 5000 });
      }

      prevExpiresAt.current = data.active && data.expiresAt ? new Date(data.expiresAt).getTime() : null;
      setState(data);
    } catch {
      // transient — next poll retries
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!state?.active) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [state?.active]);

  if (!state?.active || !state.expiresAt) return null;

  const secs = Math.max(0, Math.round((new Date(state.expiresAt).getTime() - now) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;

  return (
    <span
      className="flex items-center gap-1 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold text-[var(--gold-bright)] gold-ring"
      title="Your next win on the main game is doubled (up to +10,000) before this expires"
    >
      🎟️ 2x next win ·{" "}
      <span className="font-mono tabular-nums">
        {h > 0 ? `${h}:${String(m).padStart(2, "0")}` : m}:{String(s).padStart(2, "0")}
      </span>
    </span>
  );
}
