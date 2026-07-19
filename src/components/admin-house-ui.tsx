"use client";

// Client-side controls for the house dashboard: the Lucky Ladies pot
// override and the force-promo toggle. Same pattern as admin-ui.tsx —
// every mutation requires a typed reason and refreshes the server-rendered
// page on success.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminPost, inputCls, btnCls } from "@/components/admin-ui";
import type { Promotion } from "@/lib/promotions";

export function JackpotPanel({ pot }: { pot: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(pot));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="gold-ring rounded-xl bg-black/25 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
            Lucky Ladies pot
          </div>
          <div className="font-display text-2xl font-bold gold-text tabular-nums">
            {pot.toLocaleString()}
          </div>
        </div>
        <button
          className={btnCls}
          onClick={() => {
            setAmount(String(pot));
            setOpen((v) => !v);
          }}
        >
          Set pot
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-1.5">
          <input
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            aria-label="New jackpot amount"
          />
          <input
            className={inputCls}
            placeholder="Reason (required, audited)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-label="Reason for jackpot override"
          />
          <button
            className={btnCls}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminPost("/api/admin/jackpot", { amount: Number(amount), reason });
                toast.success(`Lucky Ladies pot set to ${Number(amount).toLocaleString()}`);
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

export function PromoForcePanel({
  schedule,
  activeOverride,
}: {
  schedule: Promotion[];
  activeOverride: { promoId: string; expiresAt: string } | null;
}) {
  const router = useRouter();
  const [promoId, setPromoId] = useState<string>(schedule[0]?.id ?? "");
  const [minutes, setMinutes] = useState("60");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gold-ring rounded-xl bg-black/25 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-[var(--cream)]/50">Force promo</div>
      {activeOverride ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-display font-semibold text-[var(--gold-bright)]">
            {schedule.find((p) => p.id === activeOverride.promoId)?.name ?? activeOverride.promoId}
          </span>
          <span className="text-xs text-[var(--cream)]/50">
            until{" "}
            {new Date(activeOverride.expiresAt).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      ) : (
        <div className="mt-1.5 text-sm text-[var(--cream)]/40">Nothing forced — schedule runs as-is.</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <select
          className={`${inputCls} w-auto flex-1`}
          value={promoId}
          onChange={(e) => setPromoId(e.target.value)}
          aria-label="Promo to force"
        >
          {schedule.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className={`${inputCls} !w-20 text-center`}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          inputMode="numeric"
          aria-label="Minutes to run"
        />
        <span className="text-xs text-[var(--cream)]/50">min</span>
      </div>
      <input
        className={`${inputCls} mt-1.5`}
        placeholder="Reason (required, audited)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label="Reason for forcing a promo"
      />
      <div className="mt-1.5 flex gap-1.5">
        <button
          className={btnCls}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await adminPost("/api/admin/promo", { promoId, minutes: Number(minutes), reason });
              toast.success(`${schedule.find((p) => p.id === promoId)?.name ?? promoId} forced on`);
            })
          }
        >
          Force on
        </button>
        {activeOverride && (
          <button
            className={`${btnCls} !border-red-400/40 !text-red-200/80`}
            disabled={busy}
            onClick={() =>
              run(async () => {
                await adminPost("/api/admin/promo", { promoId: null, reason });
                toast.success("Override cleared");
              })
            }
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
