"use client";

// Client-side controls for the pit-boss console: per-player actions and the
// bulk purge panel. Every mutation requires a typed reason (feeds the audit
// log) and refreshes the server-rendered table on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ACHIEVEMENTS } from "@/lib/achievements";

export async function adminPost(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data;
}

export const inputCls =
  "w-full rounded-lg border border-[var(--gold)]/25 bg-black/40 px-2.5 py-1.5 text-sm text-[var(--cream)] placeholder:text-[var(--cream)]/30 focus:outline-none focus:border-[var(--gold)]/60";
export const btnCls =
  "rounded-lg border border-[var(--gold)]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/70 hover:bg-[var(--gold)]/15 hover:text-[var(--cream)] transition-colors";

type Panel = "chips" | "role" | "trophy" | null;

export function PlayerActions({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: string;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [slug, setSlug] = useState(ACHIEVEMENTS[0].slug);
  const [grant, setGrant] = useState(true);

  const toggle = (p: Panel) => {
    setPanel((cur) => (cur === p ? null : p));
    setReason("");
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setPanel(null);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const banned = role === "banned";

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button className={btnCls} onClick={() => toggle("chips")}>± Chips</button>
        <button
          className={`${btnCls} ${banned ? "!border-emerald-400/40 !text-emerald-200/80" : "!border-red-400/40 !text-red-200/80"}`}
          onClick={() => toggle("role")}
        >
          {banned ? "Unban" : "Ban"}
        </button>
        <button className={btnCls} onClick={() => toggle("trophy")}>🏆</button>
      </div>

      {panel === "chips" && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-black/30 p-2.5">
          <input
            className={inputCls}
            placeholder="Delta, e.g. 5000 or -5000"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            inputMode="numeric"
            aria-label={`Chip delta for ${name}`}
          />
          <input
            className={inputCls}
            placeholder="Reason (required, audited)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for chip adjustment"
          />
          <button
            className={btnCls}
            disabled={busy}
            onClick={() =>
              run(async () => {
                const d = Number(delta);
                await adminPost(`/api/admin/users/${userId}/chips`, { delta: d, reason });
                toast.success(`${name}: chips ${d > 0 ? "+" : ""}${d.toLocaleString()}`);
              })
            }
          >
            Apply
          </button>
        </div>
      )}

      {panel === "role" && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-black/30 p-2.5">
          <input
            className={inputCls}
            placeholder={`Reason to ${banned ? "unban" : "ban"} (required, audited)`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label={`Reason to ${banned ? "unban" : "ban"} ${name}`}
          />
          <button
            className={btnCls}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await adminPost(`/api/admin/users/${userId}/role`, {
                  role: banned ? "user" : "banned",
                  reason,
                });
                toast.success(`${name} ${banned ? "unbanned" : "BANNED"}`);
              })
            }
          >
            Confirm {banned ? "unban" : "ban"}
          </button>
        </div>
      )}

      {panel === "trophy" && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-black/30 p-2.5">
          <select
            className={inputCls}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            aria-label={`Trophy to grant or revoke for ${name}`}
          >
            {ACHIEVEMENTS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.emoji} {a.name}
              </option>
            ))}
          </select>
          <select
            className={inputCls}
            value={grant ? "grant" : "revoke"}
            onChange={(e) => setGrant(e.target.value === "grant")}
            aria-label="Grant or revoke"
          >
            <option value="grant">Grant</option>
            <option value="revoke">Revoke</option>
          </select>
          <input
            className={inputCls}
            placeholder="Reason (required, audited)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for trophy change"
          />
          <button
            className={btnCls}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await adminPost(`/api/admin/users/${userId}/achievements`, { slug, grant, reason });
                toast.success(`${grant ? "Granted" : "Revoked"} ${slug} for ${name}`);
              })
            }
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function PurgePanel() {
  const router = useRouter();
  const [days, setDays] = useState("7");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--cream)]/50">
        Purge never-played accounts older than
      </span>
      <input
        className={`${inputCls} !w-16 text-center`}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        inputMode="numeric"
        aria-label="Days threshold for purge"
      />
      <span className="text-xs text-[var(--cream)]/50">days</span>
      <input
        className={`${inputCls} !w-56`}
        placeholder="Reason (required, audited)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Reason for purge"
      />
      <button
        className={`${btnCls} !border-red-400/40 !text-red-200/80`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = (await adminPost("/api/admin/purge", {
              days: Number(days),
              reason,
            })) as { deleted: number };
            toast.success(`Purged ${r.deleted} zero-play account${r.deleted === 1 ? "" : "s"}`);
            router.refresh();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Purge
      </button>
    </div>
  );
}
