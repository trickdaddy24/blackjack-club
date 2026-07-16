"use client";

// Table-invite bell: polls for pending invites every 10s and lets the
// invitee accept in place — the in-app half of the invite flow.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";

interface PendingInvite {
  id: string;
  from: string;
  expiresAt: string;
}

export function InviteBell() {
  const router = useRouter();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      if (!res.ok) return;
      const data = (await res.json()) as { invites: PendingInvite[] };
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
      const res = await fetch("/api/table/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't join");
      router.push(`/table/${data.tableId}`);
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
        aria-label={`${live.length} table invite${live.length === 1 ? "" : "s"}`}
      >
        <Bell className="h-4 w-4 animate-pulse" />
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
                  ♠️ <strong>{i.from}</strong> is holding a seat
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
