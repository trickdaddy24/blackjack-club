"use client";

// Duo Table — the shared-table client. Deliberately separate from
// GameTable.tsx (solo): different loop (poll-driven), no insurance, no bust
// bet, no trainer. Reuses the engine types, PlayingCard, and the sound kit.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Coins,
  Crown,
  DoorOpen,
  Loader2,
  Mail,
  UserX,
  X,
} from "lucide-react";
import type { ClientView, PlayerAction } from "@/lib/blackjack/engine";
import { PlayingCard } from "@/components/PlayingCard";
import { sounds } from "@/lib/sound";

interface UnlockedAchievement {
  slug: string;
  name: string;
  emoji: string;
  description: string;
}

interface TableView {
  tableId: string;
  status: string;
  youAre: "host" | "guest";
  host: { name: string; betPlaced: boolean };
  guest: { name: string; betPlaced: boolean } | null;
  round: ClientView | null;
  roundLive: boolean;
  turn: { seat: number; deadline: string | null; secondsLeft: number | null } | null;
  chips: number;
  jackpot: number;
  tableMin: { min: number; label: string };
  maxSideBet: number;
}

const POLL_MS = 1500;
const ACTION_LABELS: Record<string, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export function OpenTableButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="action-btn primary !px-8 !py-3"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ tableId: string }>("/api/table", {});
          router.push(`/table/${r.tableId}`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open a Table"}
    </button>
  );
}

export function MultiplayerTable({ tableId }: { tableId: string }) {
  const router = useRouter();
  const [view, setView] = useState<TableView | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // wager form
  const [bet, setBet] = useState(0);
  const [pp, setPp] = useState(0);
  const [tp, setTp] = useState(0);
  const [ll, setLl] = useState(0);
  // invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvite, setPendingInvite] = useState<{
    id: string;
    to: string;
    expiresAt: string;
  } | null>(null);
  const cardsSeen = useRef(0);

  const celebrate = useCallback((unlocked?: UnlockedAchievement[]) => {
    if (!unlocked?.length) return;
    sounds.coins(0.9);
    unlocked.forEach((a, i) =>
      setTimeout(
        () =>
          toast.success(`${a.emoji} Achievement unlocked — ${a.name}`, {
            description: a.description,
            duration: 9000,
          }),
        900 + i * 700
      )
    );
  }, []);

  const applyView = useCallback((v: TableView) => {
    // Deal/settle sounds keyed off how many cards appeared since last look
    const visible =
      (v.round?.hands.reduce((n, h) => n + h.cards.length, 0) ?? 0) +
      (v.round?.dealer.cards.filter(Boolean).length ?? 0);
    if (v.round && visible > cardsSeen.current) {
      const fresh = Math.min(visible - cardsSeen.current, 6);
      for (let i = 0; i < fresh; i++) sounds.deal(i * 0.12);
    }
    cardsSeen.current = v.round ? visible : 0;
    setView(v);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/table/${tableId}/state`);
      if (res.status === 404) {
        // kicked, or the table is gone — back to the lobby
        toast("The table closed", { description: "The host ended it or your seat was released." });
        router.push("/table");
        return;
      }
      if (!res.ok) return; // transient — next tick retries
      const r = (await res.json()) as { table: TableView };
      if (r.table.status === "ended") {
        toast("The host closed the table");
        router.push("/table");
        return;
      }
      applyView(r.table);
    } catch {
      // network blip — the next tick retries
    }
  }, [tableId, applyView, router]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [refresh]);

  useEffect(() => {
    if (view && bet === 0) setBet(view.tableMin.min);
  }, [view, bet]);

  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--cream)]/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding your table…
      </div>
    );
  }

  const mySeat = view.youAre === "host" ? 0 : 1;
  const myTurn = view.turn?.seat === mySeat;
  const round = view.round;
  const settled = round?.phase === "settled";
  const waitingOnGuest = view.status === "open";
  const bothSeated = view.status === "active" && view.guest !== null;
  const iBet = mySeat === 0 ? view.host.betPlaced : view.guest?.betPlaced;
  const theyBet = mySeat === 0 ? view.guest?.betPlaced : view.host.betPlaced;
  const betPhase = bothSeated && !view.roundLive;

  const deadlineMs = view.turn?.deadline ? new Date(view.turn.deadline).getTime() : null;
  const secondsLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;

  async function act(action: PlayerAction) {
    setBusy(true);
    try {
      const r = await api<{ table: TableView; unlocked?: UnlockedAchievement[] }>(
        `/api/table/${tableId}/action`,
        { action }
      );
      applyView(r.table);
      celebrate(r.unlocked);
      if (r.table.round?.phase === "settled") playResultSound(r.table, mySeat);
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function placeBet() {
    setBusy(true);
    try {
      const r = await api<{ table: TableView; unlocked?: UnlockedAchievement[] }>(
        `/api/table/${tableId}/bet`,
        { bet, pp, tp, ll }
      );
      sounds.chip();
      applyView(r.table);
      celebrate(r.unlocked);
      if (r.table.round?.phase === "settled") playResultSound(r.table, mySeat);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    setBusy(true);
    try {
      const r = await api<{ inviteId: string; to: string; expiresAt: string }>(
        "/api/table/invite",
        { email: inviteEmail.trim() }
      );
      setPendingInvite({ id: r.inviteId, to: r.to, expiresAt: r.expiresAt });
      toast.success(`Seat held for ${r.to} — 5 minutes`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function manage(op: "kick" | "end" | "leave") {
    setBusy(true);
    try {
      await api(`/api/table/${tableId}/manage`, { op });
      if (op === "end" || op === "leave") {
        router.push("/play");
        return;
      }
      setPendingInvite(null);
      void refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inviteSecs = pendingInvite
    ? Math.max(0, Math.round((new Date(pendingInvite.expiresAt).getTime() - now) / 1000))
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-3 pb-16">
      {/* status strip */}
      <div className="fade-up mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl gold-ring bg-black/25 px-4 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <Coins className="h-4 w-4 text-[var(--gold)]" />
          <span className="font-display font-bold gold-text tabular-nums">
            {view.chips.toLocaleString()}
          </span>
          <span className="text-[var(--cream)]/40">·</span>
          <span className="text-xs text-[var(--cream)]/60">
            👑 pot {view.jackpot.toLocaleString()}
          </span>
          <span className="text-[var(--cream)]/40">·</span>
          <span className="text-xs text-[var(--cream)]/60">
            min {view.tableMin.min} ({view.tableMin.label})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {view.youAre === "host" ? (
            <>
              {view.guest && (
                <button
                  className="flex items-center gap-1 rounded-lg border border-red-400/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-200/80 hover:bg-red-900/30 disabled:opacity-40"
                  onClick={() => manage("kick")}
                  disabled={busy || view.roundLive}
                  title="Remove the guest (between rounds)"
                >
                  <UserX className="h-3 w-3" /> Kick
                </button>
              )}
              <button
                className="flex items-center gap-1 rounded-lg border border-red-400/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-200/80 hover:bg-red-900/30 disabled:opacity-40"
                onClick={() => manage("end")}
                disabled={busy || view.roundLive}
                title="Close the table (between rounds)"
              >
                <X className="h-3 w-3" /> End table
              </button>
            </>
          ) : (
            <button
              className="flex items-center gap-1 rounded-lg border border-[var(--gold)]/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/70 hover:bg-[var(--gold)]/15 disabled:opacity-40"
              onClick={() => manage("leave")}
              disabled={busy || view.roundLive}
              title="Leave your seat (between rounds)"
            >
              <DoorOpen className="h-3 w-3" /> Leave
            </button>
          )}
        </div>
      </div>

      {/* waiting room: invite panel */}
      {waitingOnGuest && (
        <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center">
          <h2 className="font-display text-lg font-bold gold-text">
            <Crown className="mr-1 inline h-4 w-4" /> Your table — deal someone in
          </h2>
          {pendingInvite && inviteSecs !== null && inviteSecs > 0 ? (
            <div className="mt-4">
              <p className="text-sm text-[var(--cream)]/80">
                Seat held for <strong>{pendingInvite.to}</strong> —{" "}
                <span className="tabular-nums">
                  {Math.floor(inviteSecs / 60)}:{String(inviteSecs % 60).padStart(2, "0")}
                </span>{" "}
                left
              </p>
              <button
                className="mt-3 rounded-lg border border-[var(--gold)]/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--cream)]/70 hover:bg-[var(--gold)]/15"
                disabled={busy}
                onClick={async () => {
                  try {
                    await api("/api/table/invite/cancel", { inviteId: pendingInvite.id });
                  } catch {
                    /* already resolved */
                  }
                  setPendingInvite(null);
                }}
              >
                Cancel invite
              </button>
            </div>
          ) : (
            <div className="mx-auto mt-4 flex max-w-sm gap-2">
              <input
                className="flex-1 rounded-lg border border-[var(--gold)]/25 bg-black/40 px-3 py-2 text-sm text-[var(--cream)] placeholder:text-[var(--cream)]/30 focus:outline-none focus:border-[var(--gold)]/60"
                placeholder="member@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                aria-label="Invitee email"
              />
              <button
                className="action-btn primary !px-4 !py-2 !text-xs"
                onClick={invite}
                disabled={busy || !inviteEmail.includes("@")}
              >
                <Mail className="mr-1 inline h-3.5 w-3.5" /> Invite
              </button>
            </div>
          )}
          <p className="mt-3 text-xs text-[var(--cream)]/40">
            Members only · seat held 5 minutes · inviting someone else replaces the hold
          </p>
        </div>
      )}

      {/* the felt */}
      {round && (
        <div className="fade-up relative mt-6 rounded-3xl border-8 border-[#3a2c1c] bg-[#155134] p-5 shadow-2xl">
          {/* dealer */}
          <div className="text-center">
            <div className="mb-1 text-[11px] uppercase tracking-[0.3em] text-emerald-100/60">
              Dealer{round.dealer.total !== null ? ` ${round.dealer.total}` : ""}
            </div>
            <div className="flex justify-center gap-1.5">
              {round.dealer.cards.map((cd, i) => (
                <PlayingCard key={i} card={cd} dealDelay={i * 120} />
              ))}
            </div>
          </div>

          {/* seats */}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {[0, 1].map((seat) => {
              const name = seat === 0 ? view.host.name : (view.guest?.name ?? "—");
              const hands = round.hands.filter((h) => (h.owner ?? 0) === seat);
              const acting = view.turn?.seat === seat && !settled;
              const isMe = seat === mySeat;
              return (
                <div
                  key={seat}
                  className={`rounded-2xl p-3 text-center transition-shadow ${
                    acting ? "shadow-[0_0_0_2px_var(--gold-bright)] bg-black/20" : "bg-black/10"
                  }`}
                >
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-100/70">
                    {name}
                    {isMe && <span className="ml-1 text-[var(--gold-bright)]">(you)</span>}
                    {acting && secondsLeft !== null && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                          secondsLeft <= 10 ? "bg-red-900/70 text-red-100" : "bg-black/40 text-emerald-100/80"
                        }`}
                      >
                        {secondsLeft}s
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-start justify-center gap-3">
                    {hands.map((h, hi) => (
                      <div key={hi}>
                        <div className="flex justify-center gap-1">
                          {h.cards.map((cd, ci) => (
                            <PlayingCard key={ci} card={cd} dealDelay={ci * 120} />
                          ))}
                        </div>
                        <div className="mt-1 text-xs text-emerald-100/80 tabular-nums">
                          {h.total}
                          {h.soft ? " soft" : ""} · bet {h.bet.toLocaleString()}
                          {h.doubled ? " ×2" : ""}
                        </div>
                        <div className="mt-0.5 flex flex-wrap justify-center gap-1 text-[10px]">
                          {h.outcome && (
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                                h.outcome === "lose"
                                  ? "bg-red-900/70 text-red-100"
                                  : h.outcome === "push"
                                    ? "bg-black/40 text-emerald-100/70"
                                    : "bg-[var(--gold)]/80 text-black"
                              }`}
                            >
                              {h.outcome}
                            </span>
                          )}
                          {h.pp && h.pp.payout > 0 && (
                            <span className="rounded bg-pink-400/80 px-1.5 py-0.5 font-bold text-black">
                              PP {h.pp.label}
                            </span>
                          )}
                          {h.tp && h.tp.payout > 0 && (
                            <span className="rounded bg-sky-400/80 px-1.5 py-0.5 font-bold text-black">
                              21+3 {h.tp.label}
                            </span>
                          )}
                          {h.ll && h.ll.payout > 0 && (
                            <span className="rounded bg-purple-400/80 px-1.5 py-0.5 font-bold text-black">
                              LL {h.ll.label}
                            </span>
                          )}
                          {h.llJackpot && (
                            <span className="rounded bg-[var(--gold-bright)] px-1.5 py-0.5 font-bold text-black">
                              👑 JACKPOT
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {hands.length === 0 && (
                      <div className="py-6 text-xs text-emerald-100/40">sitting out</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* my actions */}
          {round.phase === "player" && myTurn && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {round.actions.map((a) => (
                <button
                  key={a}
                  className="action-btn primary !px-5"
                  disabled={busy}
                  onClick={() => act(a)}
                >
                  {ACTION_LABELS[a] ?? a}
                </button>
              ))}
            </div>
          )}
          {round.phase === "player" && !myTurn && (
            <p className="mt-6 text-center text-sm text-emerald-100/70">
              {view.turn?.seat === 0 ? view.host.name : view.guest?.name} is deciding…
              {secondsLeft !== null && ` auto-stand in ${secondsLeft}s`}
            </p>
          )}
        </div>
      )}

      {/* betting row */}
      {betPhase && (
        <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5">
          {iBet ? (
            <p className="text-center text-sm text-[var(--cream)]/70">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Wager locked — waiting for{" "}
              {mySeat === 0 ? view.guest?.name : view.host.name} to bet…
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <LabeledNumber label={`Bet (min ${view.tableMin.min})`} value={bet} onChange={setBet} />
                <LabeledNumber label="Perfect Pairs" value={pp} onChange={setPp} max={view.maxSideBet} />
                <LabeledNumber label="21+3" value={tp} onChange={setTp} max={view.maxSideBet} />
                <LabeledNumber label="Lucky Ladies" value={ll} onChange={setLl} max={view.maxSideBet} />
              </div>
              <div className="mt-4 text-center">
                <button className="action-btn primary !px-8" disabled={busy} onClick={placeBet}>
                  {theyBet ? "Bet & Deal" : "Place Bet"}
                </button>
                {theyBet && (
                  <p className="mt-2 text-xs text-[var(--cream)]/50">
                    {mySeat === 0 ? view.guest?.name : view.host.name} is ready — your bet starts the deal
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {bothSeated && settled && !betPhase && null}
    </div>
  );
}

function playResultSound(v: TableView, mySeat: number) {
  const mine = v.round?.hands.filter((h) => (h.owner ?? 0) === mySeat) ?? [];
  const net = mine.reduce((n, h) => n + h.payout - h.bet, 0);
  if (mine.some((h) => h.outcome === "blackjack")) sounds.blackjack(0.4);
  else if (net > 0) sounds.win(0.4);
  else if (net < 0) sounds.lose(0.4);
  else sounds.push(0.4);
}

function LabeledNumber({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
        {label}
      </span>
      <input
        type="number"
        min={0}
        {...(max ? { max } : {})}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        className="w-full rounded-lg border border-[var(--gold)]/25 bg-black/40 px-3 py-2 text-sm text-[var(--cream)] focus:outline-none focus:border-[var(--gold)]/60"
      />
    </label>
  );
}
