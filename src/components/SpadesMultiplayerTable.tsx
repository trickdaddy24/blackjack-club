"use client";

// Spades Duo — the shared 4-seat partnership table client (v0.48.0).
// Deliberately a NEW component, separate from both MultiplayerTable.tsx
// (blackjack) and the single-player /spades page (src/app/spades/page.tsx +
// useSpades.ts) — neither of those gets touched by this feature. Reuses the
// pure rendering pieces from src/spades/ui/ (CardView, CardBack, Scoreboard,
// BidPanel) since they're already viewer-agnostic or safely reusable; does
// NOT reuse SeatBadge/HandResultPanel, which hardcode seat-position labels
// assuming the viewer is always seat 0 — this table has two different human
// viewers (seat 0 and seat 2), so seat labels are computed relative to
// whichever seat the viewer occupies (see relSeat below) instead.
//
// Same poll cadence as the blackjack Duo table (POLL_MS = 1500). Every poll
// hits /api/spades-table/[id]/state, which returns the server's per-seat
// redacted view (spadesClientView) for whichever seat the requesting user
// occupies — this component never sees, and cannot request, another seat's
// cards.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail, Spade } from "lucide-react";
import type { Card } from "@/spades/engine/cards";
import { cardId } from "@/spades/engine/cards";
import { isLegalPlay } from "@/spades/engine/rules";
import type { Bid, Seat } from "@/spades/engine/types";
import { CardBack, CardView } from "@/spades/ui/CardView";
import { BidPanel, Scoreboard } from "@/spades/ui/panels";
import "@/spades/spades.css";

interface SeatHandView {
  seat: Seat;
  cards: Card[] | null;
  cardCount: number;
}

interface SpadesClientView {
  phase: "bidding" | "playing" | "handComplete" | "gameOver";
  viewerSeat: Seat;
  rules: { deucesHigh: boolean; jokers: boolean };
  dealer: Seat;
  turn: Seat;
  spadesBroken: boolean;
  hands: SeatHandView[];
  bids: (Bid | null)[];
  tricksWon: number[];
  currentTrick: { seat: Seat; card: Card }[];
  completedTrickCount: number;
  teamScores: [{ score: number; bags: number }, { score: number; bags: number }];
  targetScore: number;
  handNumber: number;
  lastHandResult: {
    handNumber: number;
    teams: [
      {
        bidTotal: number;
        tricks: number;
        points: number;
        bagsGained: number;
        bagPenalty: number;
        nilResults: { seat: Seat; bid: Bid; made: boolean; points: number }[];
      },
      {
        bidTotal: number;
        tricks: number;
        points: number;
        bagsGained: number;
        bagPenalty: number;
        nilResults: { seat: Seat; bid: Bid; made: boolean; points: number }[];
      },
    ];
  } | null;
  winner: 0 | 1 | null;
}

interface SpadesTableView {
  tableId: string;
  status: string;
  youAreSeat: 0 | 2;
  hostName: string;
  guestName: string | null;
  game: SpadesClientView | null;
  turnDeadline: string | null;
  secondsLeft: number | null;
}

const POLL_MS = 1500;

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

export function OpenSpadesTableButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="action-btn primary !px-8 !py-3"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await api<{ tableId: string }>("/api/spades-table", {});
          router.push(`/spades-table/${r.tableId}`);
        } catch (e) {
          toast.error((e as Error).message);
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open a Spades Table"}
    </button>
  );
}

/** Seat position relative to the viewer: 0 = you (South), 1 = West, 2 =
 *  partner (North), 3 = East — same screen geometry the single-player table
 *  uses, just rotated so whichever seat you're in always renders as South. */
function relSeat(seat: Seat, viewerSeat: Seat): 0 | 1 | 2 | 3 {
  return (((seat - viewerSeat + 4) % 4) as 0 | 1 | 2 | 3);
}

const TRICK_POS: Record<0 | 1 | 2 | 3, string> = {
  0: "trick__s",
  1: "trick__w",
  2: "trick__n",
  3: "trick__e",
};

export function SpadesMultiplayerTable({ tableId }: { tableId: string }) {
  const router = useRouter();
  const [view, setView] = useState<SpadesTableView | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvite, setPendingInvite] = useState<{ id: string; to: string; expiresAt: string } | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/spades-table/${tableId}/state`);
      if (res.status === 404) {
        toast("The table closed", { description: "Your seat was released." });
        router.push("/spades-table");
        return;
      }
      if (!res.ok) return; // transient — next tick retries
      const r = (await res.json()) as { table: SpadesTableView };
      setView(r.table);
    } catch {
      // network blip — the next tick retries
    }
  }, [tableId, router]);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
  }, [refresh]);

  if (!view) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--cream)]/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding your table…
      </div>
    );
  }

  const viewerSeat = view.youAreSeat;
  const game = view.game;
  const waitingOnGuest = view.status === "open";

  async function invite() {
    setBusy(true);
    try {
      const r = await api<{ inviteId: string; to: string; expiresAt: string }>("/api/spades-table/invite", {
        email: inviteEmail.trim(),
      });
      setPendingInvite({ id: r.inviteId, to: r.to, expiresAt: r.expiresAt });
      toast.success(`Seat held for ${r.to} — 5 minutes`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bid(b: Bid) {
    setBusy(true);
    try {
      const r = await api<{ table: SpadesTableView }>(`/api/spades-table/${tableId}/bid`, b);
      setView(r.table);
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function play(card: Card) {
    setBusy(true);
    try {
      const r = await api<{ table: SpadesTableView }>(`/api/spades-table/${tableId}/play`, { card });
      setView(r.table);
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  async function nextHand() {
    setBusy(true);
    try {
      const r = await api<{ table: SpadesTableView }>(`/api/spades-table/${tableId}/next-hand`, {});
      setView(r.table);
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    } finally {
      setBusy(false);
    }
  }

  const inviteSecs = pendingInvite
    ? Math.max(0, Math.round((new Date(pendingInvite.expiresAt).getTime() - now) / 1000))
    : null;

  const deadlineMs = view.turnDeadline ? new Date(view.turnDeadline).getTime() : null;
  const secondsLeft = deadlineMs ? Math.max(0, Math.ceil((deadlineMs - now) / 1000)) : null;

  const partnerName = viewerSeat === 0 ? view.guestName : view.hostName;
  const youName = viewerSeat === 0 ? view.hostName : view.guestName;

  function seatLabel(seat: Seat): string {
    const rel = relSeat(seat, viewerSeat);
    if (rel === 0) return youName ?? "You";
    if (rel === 2) return partnerName ? `${partnerName} (partner)` : "Partner";
    return rel === 1 ? "West (bot)" : "East (bot)";
  }

  // A short position-only label for the trick-area status line — the full
  // seatLabel (with real name) is long enough for a two-line partner name
  // to visually collide with the South seat badge underneath it.
  function shortSeatLabel(seat: Seat): string {
    const rel = relSeat(seat, viewerSeat);
    if (rel === 0) return "You";
    if (rel === 2) return "Partner";
    return rel === 1 ? "West" : "East";
  }

  return (
    <>
      {waitingOnGuest && (
        <div className="mx-auto w-full max-w-2xl px-3 pb-16">
          <div className="fade-up mt-6 rounded-2xl gold-ring bg-black/25 p-5 text-center">
            <h2 className="font-display text-lg font-bold gold-text">
              <Spade className="mr-1 inline h-4 w-4" fill="currentColor" /> Your Spades table — deal in a
              partner
            </h2>
            <p className="mt-2 text-xs text-[var(--cream)]/50">
              You + your partner (seats South/North) vs two bots (West/East). The table auto-starts the
              instant they accept.
            </p>
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
                      await api("/api/spades-table/invite/cancel", { inviteId: pendingInvite.id });
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
            <p className="mt-3 text-xs text-[var(--cream)]/40">Members only · seat held 5 minutes</p>
          </div>
        </div>
      )}

      {game && (
        <div className="spades-app">
          <div className="app">
            <header className="topbar">
              <div className="brand">
                Spades<span>Club</span> <i className="ver">Duo</i>
              </div>
              <Scoreboard
                state={{
                  teamScores: game.teamScores,
                  targetScore: game.targetScore,
                } as Parameters<typeof Scoreboard>[0]["state"]}
              />
              <div className="topbar__actions">
                <Link className="topbar__new" href="/spades-table" style={{ textDecoration: "none" }}>
                  ♠ Hub
                </Link>
              </div>
            </header>

            <main className="table">
              {([1, 2, 3] as Seat[]).map((absSeat) => {
                const rel = relSeat(absSeat, viewerSeat);
                if (rel === 0) return null;
                const cls = rel === 2 ? "table__n" : rel === 1 ? "table__w" : "table__e";
                const bidText = game.bids[absSeat]
                  ? game.bids[absSeat]!.tricks === 0
                    ? game.bids[absSeat]!.blind
                      ? "Blind Nil"
                      : "Nil"
                    : String(game.bids[absSeat]!.tricks)
                  : "—";
                return (
                  <div key={absSeat} className={cls}>
                    <div className={`seat seat--t${absSeat % 2} ${game.turn === absSeat ? "seat--active" : ""}`}>
                      <div className="seat__name">{seatLabel(absSeat)}</div>
                      <div className="seat__bidpill">{bidText}</div>
                      <div className="seat__won">{game.tricksWon[absSeat]} won</div>
                    </div>
                  </div>
                );
              })}

              <div className="trick">
                {game.currentTrick.map((p) => (
                  <div key={p.seat} className={`trick__slot ${TRICK_POS[relSeat(p.seat, viewerSeat)]}`}>
                    <CardView card={p.card} small />
                  </div>
                ))}
                {game.currentTrick.length === 0 && game.phase === "playing" && (
                  <div className="trick__hint">{game.spadesBroken ? "spades broken" : "spades not broken"}</div>
                )}
                <div className="trick__msg">
                  {game.phase === "bidding"
                    ? game.turn === viewerSeat
                      ? "Your bid"
                      : `${shortSeatLabel(game.turn)} is bidding…`
                    : game.phase === "playing"
                      ? game.turn === viewerSeat
                        ? "Your turn — play a card"
                        : `${shortSeatLabel(game.turn)} is playing…`
                      : ""}
                </div>
              </div>

              {([1, 2, 3] as Seat[]).map((absSeat) => {
                const rel = relSeat(absSeat, viewerSeat);
                if (rel === 0) return null;
                const hand = game.hands.find((h) => h.seat === absSeat)!;
                const outerCls = rel === 2 ? "oppcards oppcards--n" : rel === 1 ? "oppcards oppcards--w" : "oppcards oppcards--e";
                const backsCls = rel === 2 ? "backs" : "backs backs--side";
                return (
                  <div key={absSeat} className={outerCls}>
                    <div className={backsCls}>
                      {Array.from({ length: hand.cardCount }, (_, i) => (
                        <CardBack key={i} small />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="table__s">
                <div className={`seat seat--t${viewerSeat % 2} ${game.turn === viewerSeat ? "seat--active" : ""}`}>
                  <div className="seat__name">
                    You
                    {game.turn === viewerSeat && secondsLeft !== null && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 font-mono text-[11px] ${
                          secondsLeft <= 10 ? "bg-red-900/70 text-red-100" : "bg-black/40 text-emerald-100/80"
                        }`}
                      >
                        {secondsLeft}s
                      </span>
                    )}
                  </div>
                  <div className="seat__bidpill">
                    {game.bids[viewerSeat]
                      ? game.bids[viewerSeat]!.tricks === 0
                        ? game.bids[viewerSeat]!.blind
                          ? "Blind Nil"
                          : "Nil"
                        : String(game.bids[viewerSeat]!.tricks)
                      : "—"}
                  </div>
                  <div className="seat__won">{game.tricksWon[viewerSeat]} won</div>
                </div>
              </div>
            </main>

            <section className="myhand">
              {(game.hands.find((h) => h.seat === viewerSeat)?.cards ?? []).map((c) => {
                const myHand = game.hands.find((h) => h.seat === viewerSeat)!.cards!;
                const canPlay =
                  game.phase === "playing" &&
                  game.turn === viewerSeat &&
                  isLegalPlay(c, myHand, game.currentTrick, game.spadesBroken, game.rules);
                return (
                  <CardView
                    key={cardId(c)}
                    card={c}
                    playable={canPlay}
                    disabled={game.phase === "playing" && !canPlay}
                    onClick={game.phase === "playing" && !busy ? () => play(c) : undefined}
                  />
                );
              })}
            </section>

            {game.phase === "bidding" && game.turn === viewerSeat && (
              <BidPanel onBid={bid} canBlindNil={game.bids[viewerSeat] === null} />
            )}

            {(game.phase === "handComplete" || game.phase === "gameOver") && game.lastHandResult && (
              <div className="modal">
                <div className="modal__card">
                  <h2 className="modal__title">
                    {game.phase === "gameOver"
                      ? game.winner === 0
                        ? "🏆 You + partner win the game!"
                        : "West + East (bots) win the game"
                      : `Hand ${game.lastHandResult.handNumber} complete`}
                  </h2>
                  <div className="resultgrid">
                    {game.lastHandResult.teams.map((tr, i) => (
                      <div key={i} className={`resultcol resultcol--t${i}`}>
                        <div className="resultcol__team">{i === 0 ? "You + Partner" : "West + East"}</div>
                        <div className="resultcol__line">
                          bid {tr.bidTotal} · took {tr.tricks}
                        </div>
                        {tr.nilResults.map((n, j) => (
                          <div key={j} className={`resultcol__nil ${n.made ? "ok" : "bad"}`}>
                            {seatLabel(n.seat)} {n.bid.blind ? "Blind Nil" : "Nil"}: {n.made ? "made" : "failed"}{" "}
                            {n.points > 0 ? "+" : ""}
                            {n.points}
                          </div>
                        ))}
                        {tr.bagPenalty !== 0 && <div className="resultcol__bag">bag penalty {tr.bagPenalty}</div>}
                        <div className={`resultcol__pts ${tr.points >= 0 ? "ok" : "bad"}`}>
                          {tr.points >= 0 ? "+" : ""}
                          {tr.points}
                        </div>
                        <div className="resultcol__total">total {game.teamScores[i].score}</div>
                      </div>
                    ))}
                  </div>
                  {game.phase === "gameOver" ? (
                    <Link className="bigbtn" href="/spades-table">
                      Back to Spades hub
                    </Link>
                  ) : (
                    <button className="bigbtn" disabled={busy} onClick={nextHand}>
                      Deal next hand
                    </button>
                  )}
                </div>
              </div>
            )}

            <footer className="foot">
              Partnership Spades · You + {partnerName ?? "partner"} vs 2 bots · to {game.targetScore}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
