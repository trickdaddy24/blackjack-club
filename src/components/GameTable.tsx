"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Gift, Loader2, Volume2, VolumeX } from "lucide-react";
import type { ClientView, PlayerAction } from "@/lib/blackjack/engine";
import { PlayingCard } from "@/components/PlayingCard";
import { sounds } from "@/lib/sound";

const CHIP_VALUES = [5, 25, 100, 500, 1000] as const;
const MIN_BET = 5;
const MAX_BET = 1_000_000;

interface TableState {
  chips: number;
  bonusAvailable: boolean;
  round: ClientView | null;
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data as T;
}

/** Face-up cards on the table (used to count how many were just dealt). */
function visibleCards(view: ClientView | null): number {
  if (!view) return 0;
  return (
    view.hands.reduce((sum, h) => sum + h.cards.length, 0) + view.dealer.cards.length
  );
}

/** Play the settlement sound after any deal-sound stagger. */
function playResult(view: ClientView, delay: number) {
  if (view.hands.some((h) => h.outcome === "blackjack")) {
    sounds.blackjack(delay);
  } else if ((view.netResult ?? 0) > 0) {
    sounds.win(delay);
  } else if ((view.netResult ?? 0) < 0) {
    sounds.lose(delay);
  } else {
    sounds.push(delay);
  }
}

export function GameTable() {
  const [chips, setChips] = useState<number | null>(null);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [round, setRound] = useState<ClientView | null>(null);
  const [pendingBet, setPendingBet] = useState(0);
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(sounds.muted);
  }, []);

  useEffect(() => {
    api<TableState>("/api/game/state")
      .then((s) => {
        setChips(s.chips);
        setBonusAvailable(s.bonusAvailable);
        setRound(s.round);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const applyResponse = useCallback((r: { chips: number; round: ClientView }) => {
    setChips(r.chips);
    setRound(r.round);
  }, []);

  async function deal() {
    if (pendingBet < MIN_BET) return;
    setBusy(true);
    try {
      const r = await api<{ chips: number; round: ClientView }>("/api/game/bet", {
        bet: pendingBet,
        hands: seats,
      });
      applyResponse(r);
      // Opening deal: two cards per seat plus the dealer's two
      const dealt = seats * 2 + 2;
      for (let i = 0; i < dealt; i++) sounds.deal(i * 0.13);
      if (r.round.phase === "settled") playResult(r.round, dealt * 0.13 + 0.3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: PlayerAction) {
    setBusy(true);
    const before = visibleCards(round);
    try {
      const r = await api<{ chips: number; round: ClientView }>("/api/game/action", {
        action,
      });
      applyResponse(r);
      const settled = r.round.phase === "settled";
      // The reveal turns the hole-card slot from null into a card, so it
      // doesn't change the count — every extra is a genuinely new card.
      const newCards = Math.min(Math.max(visibleCards(r.round) - before, 0), 6);
      for (let i = 0; i < newCards; i++) sounds.deal(i * 0.13);
      if (settled) {
        sounds.flip(newCards * 0.13);
        playResult(r.round, newCards * 0.13 + 0.35);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function claimBonus() {
    setBusy(true);
    try {
      const r = await api<{ chips: number; granted: number; type: string }>("/api/bonus", {});
      setChips(r.chips);
      setBonusAvailable(false);
      sounds.coins();
      toast.success(
        r.type === "daily"
          ? `Daily bonus: +${r.granted.toLocaleString()} chips`
          : `The house staked you ${r.chips.toLocaleString()} chips`
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function newHand() {
    setRound(null);
    setPendingBet(0);
  }

  const settled = round?.phase === "settled";
  const betting = !round || settled;
  const broke = chips !== null && chips < MIN_BET && betting;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 pb-6">
      {/* chips HUD */}
      <div className="mb-3 flex items-center justify-between">
        <div className="gold-ring flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5">
          <Coins className="h-4 w-4 text-[var(--gold-bright)]" />
          <span className="font-display text-lg font-bold gold-text tabular-nums">
            {loading || chips === null ? "—" : chips.toLocaleString()}
          </span>
          <span className="text-xs uppercase tracking-widest text-[var(--cream-dim)]/60">chips</span>
        </div>

        <div className="flex items-center gap-2">
          {(bonusAvailable || broke) && !loading && (
            <button
              onClick={claimBonus}
              disabled={busy}
              className="action-btn flex items-center gap-2 !py-2"
            >
              <Gift className="h-4 w-4" />
              {bonusAvailable ? "Daily Bonus" : "House Stake"}
            </button>
          )}
          <button
            onClick={() => {
              const next = !muted;
              sounds.setMuted(next);
              setMuted(next);
              if (!next) sounds.chip();
            }}
            className="gold-ring flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-[var(--cream)]/60 transition-colors hover:text-[var(--gold-bright)]"
            title={muted ? "Unmute sounds" : "Mute sounds"}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* the felt */}
      <div className="felt-table flex flex-1 flex-col rounded-[46%_46%_38px_38px/90px_90px_38px_38px] px-2 pb-5 pt-6 sm:px-10 sm:pb-6 sm:pt-8">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--gold)]" />
          </div>
        ) : (
          <>
            {/* dealer */}
            <div className="flex min-h-[105px] flex-col items-center gap-2 sm:min-h-[130px]">
              <span className="text-[11px] uppercase tracking-[0.35em] text-[var(--cream)]/50">
                Dealer
                {round && round.dealer.total !== null && (
                  <span className="ml-2 text-[var(--gold-bright)]">{round.dealer.total}</span>
                )}
              </span>
              <div className="flex gap-2">
                {round?.dealer.cards.map((card, i) => (
                  <PlayingCard
                    key={card ? `d-${i}-${card.rank}${card.suit}` : `d-${i}-back`}
                    card={card}
                    dealDelay={round.phase === "settled" ? i * 120 : i * 150}
                    flip={i === 1 && round.dealer.revealed}
                  />
                ))}
              </div>
            </div>

            {/* table imprint */}
            <div className="pointer-events-none my-2 flex flex-col items-center select-none">
              <svg viewBox="0 0 560 120" className="w-full max-w-md opacity-80">
                <defs>
                  <path id="arc1" d="M 40 105 Q 280 -25 520 105" fill="none" />
                  <path id="arc2" d="M 40 118 Q 280 12 520 118" fill="none" />
                </defs>
                <text className="font-display" fontSize="30" fontWeight="700" fill="var(--gold)" letterSpacing="6">
                  <textPath href="#arc1" startOffset="50%" textAnchor="middle">
                    BLACKJACK PAYS 3 TO 2
                  </textPath>
                </text>
                <text fontSize="12" fill="rgba(246,238,218,0.55)" letterSpacing="2">
                  <textPath href="#arc2" startOffset="50%" textAnchor="middle">
                    SIX DECKS · DEALER STANDS ON ALL 17s · INSURANCE 2:1
                  </textPath>
                </text>
              </svg>
            </div>

            {/* player hands */}
            <div className="flex min-h-[120px] flex-wrap items-start justify-center gap-2 sm:min-h-[150px] sm:gap-6">
              {round ? (
                round.hands.map((hand, hi) => {
                  const active = !settled && round.phase === "player" && hi === round.active;
                  return (
                    <div
                      key={hi}
                      className={`flex flex-col items-center gap-2 rounded-2xl p-3 transition-all ${
                        active ? "bg-black/25 shadow-[0_0_0_1.5px_var(--gold),0_0_28px_rgba(201,162,39,0.25)]" : ""
                      }`}
                    >
                      <div className="flex gap-2">
                        {hand.cards.map((card, ci) => (
                          <PlayingCard
                            key={`h${hi}-${ci}-${card.rank}${card.suit}`}
                            card={card}
                            dealDelay={
                              hand.cards.length === 2 &&
                              round.hands.every((h) => h.cards.length === 2)
                                ? (ci * round.hands.length + hi) * 130
                                : 0
                            }
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-[var(--gold-bright)] tabular-nums">
                          {hand.total}
                          {hand.soft ? " soft" : ""}
                        </span>
                        <span className="text-[var(--cream)]/50 tabular-nums">bet {hand.bet}</span>
                        {hand.doubled && (
                          <span className="rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--gold-bright)]">
                            2×
                          </span>
                        )}
                        {hand.outcome && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              hand.outcome === "lose"
                                ? "bg-red-900/60 text-red-200"
                                : hand.outcome === "push"
                                  ? "bg-black/40 text-[var(--cream-dim)]"
                                  : "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                            }`}
                          >
                            {hand.outcome === "blackjack" ? "Blackjack!" : hand.outcome}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="mt-8 text-sm uppercase tracking-[0.3em] text-[var(--cream)]/40">
                  Place your bet
                </p>
              )}
            </div>

            {/* result banner */}
            {settled && round && (
              <ResultBanner net={round.netResult ?? 0} onNext={newHand} disabled={busy} />
            )}

            {/* controls */}
            <div className="mt-auto pt-4">
              {round?.phase === "insurance" ? (
                <InsurancePrompt
                  cost={round.insuranceCost}
                  onAnswer={(yes) => act(yes ? "insurance-yes" : "insurance-no")}
                  disabled={busy}
                  canAfford={(chips ?? 0) >= round.insuranceCost}
                />
              ) : round && !settled ? (
                <ActionBar
                  actions={round.actions}
                  chips={chips ?? 0}
                  handBet={round.hands[round.active]?.bet ?? 0}
                  onAction={act}
                  disabled={busy}
                />
              ) : betting && !settled ? (
                <BetPicker
                  chips={chips ?? 0}
                  pending={pendingBet}
                  seats={seats}
                  onSeats={(n) => {
                    sounds.chip();
                    setSeats(n);
                  }}
                  onAdd={(v) => {
                    sounds.chip();
                    setPendingBet((p) =>
                      Math.min(p + v, MAX_BET, Math.floor((chips ?? 0) / seats))
                    );
                  }}
                  onAllIn={() => {
                    sounds.coins();
                    setPendingBet(Math.min(Math.floor((chips ?? 0) / seats), MAX_BET));
                  }}
                  onClear={() => setPendingBet(0)}
                  onDeal={deal}
                  disabled={busy}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultBanner({
  net,
  onNext,
  disabled,
}: {
  net: number;
  onNext: () => void;
  disabled: boolean;
}) {
  const title = net > 0 ? "YOU WIN" : net < 0 ? "HOUSE WINS" : "PUSH";
  return (
    <div className="result-banner mx-auto mt-3 flex flex-col items-center gap-2">
      <div className="font-display text-3xl font-black tracking-[0.15em]">
        <span className={net > 0 ? "gold-text" : net < 0 ? "text-red-300/90" : "text-[var(--cream-dim)]"}>
          {title}
        </span>
      </div>
      <div className="text-sm tabular-nums text-[var(--cream)]/70">
        {net > 0 ? `+${net.toLocaleString()} chips` : net < 0 ? `${net.toLocaleString()} chips` : "Your bet is returned"}
      </div>
      <button className="action-btn primary mt-1" onClick={onNext} disabled={disabled}>
        New Hand
      </button>
    </div>
  );
}

function InsurancePrompt({
  cost,
  onAnswer,
  disabled,
  canAfford,
}: {
  cost: number;
  onAnswer: (yes: boolean) => void;
  disabled: boolean;
  canAfford: boolean;
}) {
  return (
    <div className="fade-up mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-black/35 p-4 gold-ring">
      <p className="font-display text-lg font-bold gold-text tracking-wide">Insurance?</p>
      <p className="text-xs text-[var(--cream)]/60">
        The dealer is showing an ace. Insurance costs {cost} chips and pays 2 to 1 on a dealer blackjack.
      </p>
      <div className="flex gap-3">
        <button
          className="action-btn"
          onClick={() => onAnswer(true)}
          disabled={disabled || !canAfford}
        >
          Take ({cost})
        </button>
        <button className="action-btn primary" onClick={() => onAnswer(false)} disabled={disabled}>
          No Thanks
        </button>
      </div>
    </div>
  );
}

function ActionBar({
  actions,
  chips,
  handBet,
  onAction,
  disabled,
}: {
  actions: PlayerAction[];
  chips: number;
  handBet: number;
  onAction: (a: PlayerAction) => void;
  disabled: boolean;
}) {
  const canAffordExtra = chips >= handBet;
  return (
    <div className="fade-up flex flex-wrap items-center justify-center gap-3">
      {actions.includes("hit") && (
        <button className="action-btn primary" onClick={() => onAction("hit")} disabled={disabled}>
          Hit
        </button>
      )}
      {actions.includes("stand") && (
        <button className="action-btn" onClick={() => onAction("stand")} disabled={disabled}>
          Stand
        </button>
      )}
      {actions.includes("double") && (
        <button
          className="action-btn"
          onClick={() => onAction("double")}
          disabled={disabled || !canAffordExtra}
          title={canAffordExtra ? undefined : "Not enough chips to double"}
        >
          Double
        </button>
      )}
      {actions.includes("split") && (
        <button
          className="action-btn"
          onClick={() => onAction("split")}
          disabled={disabled || !canAffordExtra}
          title={canAffordExtra ? undefined : "Not enough chips to split"}
        >
          Split
        </button>
      )}
    </div>
  );
}

function BetPicker({
  chips,
  pending,
  seats,
  onSeats,
  onAdd,
  onAllIn,
  onClear,
  onDeal,
  disabled,
}: {
  chips: number;
  pending: number;
  seats: number;
  onSeats: (n: number) => void;
  onAdd: (v: number) => void;
  onAllIn: () => void;
  onClear: () => void;
  onDeal: () => void;
  disabled: boolean;
}) {
  const total = pending * seats;
  const allInAmount = Math.floor(chips / seats);
  const isAllIn = pending > 0 && pending === allInAmount;
  return (
    <div className="fade-up flex flex-col items-center gap-4">
      <div className="flex items-end gap-2 sm:gap-3">
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            className={`chip-btn chip-${v}`}
            onClick={() => onAdd(v)}
            disabled={disabled || pending + v > MAX_BET || (pending + v) * seats > chips}
            aria-label={`Add ${v} chip`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* seat selector */}
      <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 gold-ring">
        {[1, 2].map((n) => (
          <button
            key={n}
            onClick={() => onSeats(n)}
            disabled={disabled || (n === 2 && pending * 2 > chips && pending > 0)}
            className={`rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-35 ${
              seats === n
                ? "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                : "text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
            }`}
          >
            {n === 1 ? "1 Hand" : "2 Hands"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <div className="min-w-24 text-center sm:min-w-28">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--cream)]/50">
            {seats === 2 ? "Bet × 2" : "Bet"}
          </div>
          <div className="font-display text-2xl font-bold gold-text tabular-nums">
            {pending.toLocaleString()}
            {seats === 2 && (
              <span className="ml-1 text-sm text-[var(--cream)]/50">
                = {total.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <button
          className="text-xs uppercase tracking-wider text-[var(--cream)]/50 underline-offset-4 hover:underline disabled:opacity-40"
          onClick={onClear}
          disabled={disabled || pending === 0}
        >
          Clear
        </button>
        <button
          className={`action-btn !border-red-400/50 !text-red-200 ${isAllIn ? "!bg-red-900/40" : ""}`}
          onClick={onAllIn}
          disabled={disabled || allInAmount < MIN_BET || isAllIn}
          title={`Bet your whole stack${seats === 2 ? " (split across both hands)" : ""}`}
        >
          All In
        </button>
        <button
          className="action-btn primary !px-10 !text-base"
          onClick={onDeal}
          disabled={disabled || pending < MIN_BET || total > chips}
        >
          Deal
        </button>
      </div>
      {chips < MIN_BET && (
        <p className="text-xs text-[var(--cream)]/50">
          You&apos;re out of chips — claim the house stake above to keep playing.
        </p>
      )}
    </div>
  );
}
