"use client";

// Spades table-invite bell: polls for pending Spades invites every 10s and
// lets the invitee accept in place. A separate component (not a modified
// InviteBell) so the live blackjack Duo invite flow keeps zero regression
// risk from this work — same polling/accept pattern, different endpoints.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spade } from "lucide-react";
import { toast } from "sonner";

interface PendingSpadesInvite {
  id: string;
  from: string;
  expiresAt: string;
}

export function SpadesInviteBell() {
  const router = useRouter();
  const [invites, setInvites] = useState<PendingSpadesInvite[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/spades-invites");
      if (!res.ok) return;
      const data = (await res.json()) as { invites: PendingSpadesInvite[] };
      setInvites(data.invites);
    } catch {
      // network blip — next poll retries
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [poll]);

  const live = invites.filter((i) => new Date(i.expiresAt).getTime() > now);
  if (live.length === 0) return null;

  async function accept(id: string) {
    try {
      const res = await fetch("/api/spades-table/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join");
      router.push(`/spades-table/${data.tableId}`);
    } catch (e) {
      toast.error((e as Error).message);
      void poll();
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center text-[var(--gold-bright)]"
        aria-label={`${live.length} Spades invite${live.length === 1 ? "" : "s"}`}
      >
        <Spade className="h-4 w-4 animate-pulse" fill="currentColor" />
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
          {live.length}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 rounded-xl border border-[var(--gold)]/30 bg-[#1a1512] p-3 shadow-xl">
          {live.map((i) => {
            const secs = Math.max(0, Math.round((new Date(i.expiresAt).getTime() - now) / 1000));
            return (
              <div key={i.id} className="mb-2 last:mb-0">
                <div className="text-sm text-[var(--cream)]/90">
                  ♠️ <strong>{i.from}</strong> wants a Spades partner
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs tabular-nums text-[var(--cream)]/50">
                    {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} left
                  </span>
                  <button
                    onClick={() => accept(i.id)}
                    className="rounded-lg bg-[var(--gold)]/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black hover:bg-[var(--gold)]"
                  >
                    Take the seat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
