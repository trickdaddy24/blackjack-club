"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

/** "Create a tournament" — opens a lobby, paying the buy-in as the first entrant. */
export function TournamentListActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/tournaments", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.push(`/tournaments/${data.lobbyId}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <button className="action-btn primary !px-8 !py-3" disabled={busy} onClick={create}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start a Tournament — 1,000 chips"}
    </button>
  );
}
