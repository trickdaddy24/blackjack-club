"use client";

// Sit-and-go tournament room. Deliberately separate from GameTable.tsx
// (solo) and MultiplayerTable.tsx (duo): single seat vs the dealer like
// solo, but poll-driven and self-paced like duo, with no side bets, no
// bots, and a live leaderboard sidebar instead of a second seat. Reuses the
// engine types, PlayingCard, and the sound kit.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coins, Crown, DoorOpen, Loader2, Medal, Play, Trophy, Users } from "lucide-react";
import type { ClientView, PlayerAction } from "@/lib/blackjack/engine";
import { PlayingCard } from "@/components/PlayingCard";
import { sounds } from "@/lib/sound";

const CHIP_VALUES = [5, 25, 100, 500, 1000] as const;
const POLL_MS = 2000;
const ACTION_LABELS: Record<string, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
  "insurance-yes": "Take Insurance",
  "insurance-no": "No Insurance",
  "even-money-yes": "Even Money",
  "even-money-no": "Play On",
};

interface LeaderboardRow {
  userId: string;
  name: string;
  isMe: boolean;
  stack: number;
  handsPlayed: number;
  status: string;
  rank: number | null;
  prize: number;
}

interface LobbyView {
  id: string;
  status: "open" | "active" | "settled" | "canceled";
  creatorId: string;
  buyIn: number;
  prizePool: number;
  minEntrants: number;
  maxEntrants: number;
  handsPerEntrant: number;
  startedAt: string | null;
  deadlineAt: string | null;
  settledAt: string | null;
  leaderboard: LeaderboardRow[];
  myEntry: {
    id: string;
    stack: number;
    handsPlayed: number;
    status: string;
    round: ClientView | null;
  } | null;
}

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

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-[var(--gold-bright)]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-300" />;
  return <span className="w-4 text-center font-mono text-xs text-[var(--cream)]/40 tabular-nums">{rank}</span>;
}

function Leaderboard({ rows, handsPerEntrant }: { rows: LeaderboardRow[]; handsPerEntrant: number }) {
  return (
    <div className="fade-up gold-ring rounded-2xl bg-black/25 p-4">
      <h3 className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-widest text-[var(--gold-bright)]">
        <Trophy className="h-4 w-4" /> Leaderboard
      </h3>
      <ul className="divide-y divide-[var(--gold)]/10">
        {rows.map((r, i) => (
          <li
            key={r.userId}
            className={`flex items-center gap-2 py-2 text-sm ${
              r.isMe ? "bg-[var(--gold)]/10" : ""
            }`}
          >
            <span className="flex w-5 justify-center">
              <RankIcon rank={r.rank ?? i + 1} />
            </span>
            <span className="flex-1 truncate">
              {r.name}
              {r.isMe && <span className="ml-1 text-[10px] text-[var(--gold-bright)]">(you)</span>}
              {(r.status === "forfeited" || r.status === "backed-out" || r.status === "refunded") && (
                <span className="ml-1 text-[10px] uppercase text-[var(--cream)]/35">
                  {r.status === "forfeited" ? "forfeited" : "out"}
                </span>
              )}
            </span>
            <span className="text-[11px] text-[var(--cream)]/40 tabular-nums">
              {r.handsPlayed}/{handsPerEntrant}
            </span>
            <span className="font-mono text-sm font-bold gold-text tabular-nums">
              {r.stack.toLocaleString()}
            </span>
            {r.prize > 0 && (
              <span className="rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold-bright)]">
                +{r.prize.toLocaleString()}
              </span>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-4 text-center text-xs text-[var(--cream)]/40">No entrants yet.</li>
        )}
      </ul>
    </div>
  );
}

function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const msLeft = Math.max(0, new Date(deadlineAt).getTime() - now);
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  return (
    <span className="tabular-nums">
      {h}h {String(m).padStart(2, "0")}m left
    </span>
  );
}

export function TournamentRoom({ lobbyId }: { lobbyId: string }) {
  const router = useRouter();
  const [view, setView] = useState<LobbyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [bet, setBet] = useState(25);
  const cardsSeen = useRef(0);

  const applyView = useCallback((v: LobbyView) => {
    const visible =
      (v.myEntry?.round?.hands.reduce((n, h) => n + h.cards.length, 0) ?? 0) +
      (v.myEntry?.round?.dealer.cards.filter(Boolean).length ?? 0);
    if (v.myEntry?.round && visible > cardsSeen.current) {
      const fresh = Math.min(visible - cardsSeen.current, 6);
      for (let i = 0; i < fresh; i++) sounds.deal(i * 0.12);
    }
    cardsSeen.current = v.myEntry?.round ? visible : 0;
    setView(v);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ lobby: LobbyView }>(`/api/tournaments/${lobbyId}`);
      applyView(r.lobby);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [lobbyId, applyView]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (view?.myEntry && bet > view.myEntry.stack) setBet(Math.max(5, view.myEntry.stack));
  }, [view, bet]);

  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--cream)]/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding your tournament…
      </div>
    );
  }

  function playResultSound(round: ClientView) {
    const hand = round.hands[0];
    if (!hand) return;
    const net = hand.payout - hand.bet;
    if (hand.outcome === "blackjack") sounds.blackjack(0.4);
    else if (net > 0) sounds.win(0.4);
    else if (net < 0) sounds.lose(0.4);
    else sounds.push(0.4);
  }

  async function join() {
    setBusy(true);
    try {
      const r = await api<{ lobby: LobbyView }>(`/api/tournaments/${lobbyId}/join`, {});
      sounds.chip();
      applyView(r.lobby);
      toast.success("You're in — good luck!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function backOut() {
    setBusy(true);
    try {
      await api(`/api/tournaments/${lobbyId}/back-out`, {});
      toast("You backed out — buy-in refunded");
      router.push("/tournaments");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      const r = await api<{ lobby: LobbyView }>(`/api/tournaments/${lobbyId}/start`, {});
      applyView(r.lobby);
      toast.success("Tournament started — 24 hours on the clock");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deal() {
    setBusy(true);
    try {
      const r = await api<{ round: ClientView }>(`/api/tournaments/${lobbyId}/bet`, { bet });
      sounds.chip();
      void refresh();
      if (r.round.phase === "settled") playResultSound(r.round);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: PlayerAction) {
    setBusy(true);
    try {
      const r = await api<{ round: ClientView }>(`/api/tournaments/${lobbyId}/action`, { action });
      void refresh();
      if (r.round.phase === "settled") playResultSound(r.round);
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const { status, myEntry, leaderboard } = view;
  const entrantCount = leaderboard.filter((r) => r.status === "joined" || r.status === "playing").length;
  const isCreator = view.creatorId === (leaderboard.find((r) => r.isMe)?.userId ?? "");
  const round = myEntry?.round ?? null;
  const stack = myEntry?.stack ?? 0;

  return (
    <div className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-3 pb-16 lg:grid-cols-[1fr_320px]">
      <div>
        {/* status strip */}
        <div className="fade-up mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl gold-ring bg-black/25 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Coins className="h-4 w-4 text-[var(--gold)]" />
            <span className="text-xs text-[var(--cream)]/60">
              Buy-in <span className="font-semibold gold-text">{view.buyIn.toLocaleString()}</span>
            </span>
            <span className="text-[var(--cream)]/40">·</span>
            <span className="text-xs text-[var(--cream)]/60">
              Pool <span className="font-semibold gold-text">{view.prizePool.toLocaleString()}</span> (60/40)
            </span>
            <span className="text-[var(--cream)]/40">·</span>
            <span className="flex items-center gap-1 text-xs text-[var(--cream)]/60">
              <Users className="h-3.5 w-3.5" /> {entrantCount}/{view.maxEntrants}
            </span>
            {status === "active" && view.deadlineAt && (
              <>
                <span className="text-[var(--cream)]/40">·</span>
                <span className="text-xs text-[var(--cream)]/60">
                  <Countdown deadlineAt={view.deadlineAt} />
                </span>
              </>
            )}
          </div>
          {status === "open" && myEntry?.status === "joined" && (
            <button
              className="flex items-center gap-1 rounded-lg border border-red-400/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-200/80 hover:bg-red-900/30 disabled:opacity-40"
              onClick={backOut}
              disabled={busy}
              title="Back out — full refund"
            >
              <DoorOpen className="h-3 w-3" /> Back out
            </button>
          )}
        </div>

        {/* open lobby: waiting room */}
        {status === "open" && (
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center">
            <h2 className="font-display text-lg font-bold gold-text">Waiting room</h2>
            <p className="mt-2 text-sm text-[var(--cream)]/60">
              Needs {view.minEntrants}+ to start manually, auto-starts at {view.maxEntrants}.
            </p>
            {!myEntry && (
              <button className="action-btn primary mt-4 !px-8" onClick={join} disabled={busy}>
                Join — {view.buyIn.toLocaleString()} chips
              </button>
            )}
            {myEntry?.status === "joined" && isCreator && (
              <button
                className="action-btn primary mt-4 flex items-center gap-1.5 !px-8"
                onClick={start}
                disabled={busy || entrantCount < view.minEntrants}
              >
                <Play className="h-3.5 w-3.5" /> Start now ({entrantCount}/{view.minEntrants}+)
              </button>
            )}
            {myEntry?.status === "backed-out" && (
              <p className="mt-4 text-sm text-[var(--cream)]/50">You backed out — refunded.</p>
            )}
          </div>
        )}

        {status === "canceled" && (
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center text-sm text-[var(--cream)]/60">
            This tournament never reached the {view.minEntrants}-player minimum and was canceled —
            everyone was refunded in full.
          </div>
        )}

        {/* active: my table, or a spectator note */}
        {status === "active" && myEntry?.status === "playing" && (
          <div className="fade-up relative mt-6 rounded-3xl border-8 border-[#3a2c1c] bg-[#155134] p-5 shadow-2xl">
            <div className="mb-3 text-center text-xs uppercase tracking-[0.3em] text-emerald-100/60">
              Stack <span className="font-bold text-[var(--gold-bright)]">{stack.toLocaleString()}</span>
              {" · "}Hand {myEntry.handsPlayed}/{view.handsPerEntrant}
            </div>

            {round ? (
              <>
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

                <div className="mt-8 flex flex-wrap items-start justify-center gap-3">
                  {round.hands.map((h, hi) => (
                    <div key={hi} className="text-center">
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
                      {h.outcome && (
                        <span
                          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
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
                    </div>
                  ))}
                </div>

                {(round.phase === "player" || round.phase === "insurance") && (
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

                {round.phase === "settled" && (
                  <div className="mt-6 text-center">
                    <button className="action-btn primary !px-8" disabled={busy} onClick={deal}>
                      Next hand
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="fade-up flex flex-col items-center gap-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-100/60">
                  Your stack, your pace — no side bets in tournament hands
                </div>
                <div className="flex items-end gap-2 sm:gap-3">
                  {CHIP_VALUES.map((v) => (
                    <button
                      key={v}
                      className={`chip-btn chip-${v}`}
                      onClick={() => setBet((b) => Math.min(b + v, stack))}
                      disabled={busy || bet + v > stack}
                      aria-label={`Add ${v} chip`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold gold-text tabular-nums">
                    {bet.toLocaleString()}
                  </span>
                  <button
                    className="text-xs text-[var(--cream)]/50 underline-offset-2 hover:underline"
                    onClick={() => setBet(stack)}
                    disabled={busy}
                  >
                    all in
                  </button>
                  <button
                    className="text-xs text-[var(--cream)]/50 underline-offset-2 hover:underline"
                    onClick={() => setBet(5)}
                    disabled={busy}
                  >
                    clear
                  </button>
                </div>
                <button
                  className="action-btn primary !px-8"
                  disabled={busy || bet < 5 || bet > stack}
                  onClick={deal}
                >
                  Deal
                </button>
              </div>
            )}
          </div>
        )}

        {status === "active" && myEntry && myEntry.status !== "playing" && (
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center text-sm text-[var(--cream)]/60">
            {myEntry.status === "finished"
              ? `You're done — final stack ${(myEntry.stack ?? 0).toLocaleString()}. Waiting on the rest of the field.`
              : "Your run in this tournament has ended."}
          </div>
        )}

        {status === "active" && !myEntry && (
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center text-sm text-[var(--cream)]/60">
            This tournament is already underway — spectating the leaderboard.
          </div>
        )}

        {status === "settled" && (
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center">
            <h2 className="flex items-center justify-center gap-1.5 font-display text-lg font-bold gold-text">
              <Trophy className="h-5 w-5" /> Final results
            </h2>
            {myEntry && myEntry.status !== "backed-out" && myEntry.status !== "refunded" && (
              <p className="mt-2 text-sm text-[var(--cream)]/70">
                You placed{" "}
                <span className="font-bold text-[var(--gold-bright)]">
                  #{leaderboard.find((r) => r.isMe)?.rank ?? "—"}
                </span>{" "}
                with a final stack of{" "}
                <span className="font-bold text-[var(--gold-bright)]">{stack.toLocaleString()}</span>
                {(leaderboard.find((r) => r.isMe)?.prize ?? 0) > 0 &&
                  ` — won ${leaderboard.find((r) => r.isMe)?.prize.toLocaleString()} chips!`}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 lg:mt-4">
        <Leaderboard rows={leaderboard} handsPerEntrant={view.handsPerEntrant} />
      </div>
    </div>
  );
}
