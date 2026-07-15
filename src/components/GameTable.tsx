"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Crown, Eye, EyeOff, Gift, GraduationCap, HandCoins, Lightbulb, LightbulbOff, Loader2, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { rulesFor, type ClientView, type PlayerAction, type Variant } from "@/lib/blackjack/engine";
import { PlayingCard } from "@/components/PlayingCard";
import { sounds } from "@/lib/sound";

const CHIP_VALUES = [1, 5, 25, 100, 500, 1000] as const;
const SIDE_CHIP_VALUES = [1, 5, 25] as const;
const TIP_VALUES = [1, 5, 25] as const;
const MAX_BET = 1_000_000;
const MAX_SIDE_BET = 100;
const MAX_BOTS = 3;
const SHUFFLE_MS = 1200;

const VARIANT_KEY = "bj-variant";
const BOTS_KEY = "bj-bots";
const SHOW_COUNT_KEY = "bj-show-count";
const SHOW_HINTS_KEY = "bj-hints";
const TRAINER_KEY = "bj-trainer";
// v2: blind-only scoring — the old scorecard mixed hint-assisted plays into
// the accuracy number, so it resets once with the key change.
const TRAINER_STATS_KEY = "bj-trainer-stats-v2";
const TRAINER_STATS_KEY_V1 = "bj-trainer-stats";
const HAND_HINTS_KEY = "bj-hand-hints";
const SHOW_SIGN_KEY = "bj-sign";

interface TrainerStats {
  right: number;
  wrong: number;
  streak: number;
  best: number;
}

const EMPTY_TRAINER_STATS: TrainerStats = { right: 0, wrong: 0, streak: 0, best: 0 };

function loadTrainerStats(): TrainerStats {
  try {
    localStorage.removeItem(TRAINER_STATS_KEY_V1); // pre-blind-scoring scorecard
    const raw = localStorage.getItem(TRAINER_STATS_KEY);
    if (!raw) return EMPTY_TRAINER_STATS;
    const s = JSON.parse(raw) as Partial<TrainerStats>;
    return {
      right: Number.isInteger(s.right) ? (s.right as number) : 0,
      wrong: Number.isInteger(s.wrong) ? (s.wrong as number) : 0,
      streak: Number.isInteger(s.streak) ? (s.streak as number) : 0,
      best: Number.isInteger(s.best) ? (s.best as number) : 0,
    };
  } catch {
    return EMPTY_TRAINER_STATS;
  }
}

const ACTION_LABELS: Record<string, string> = {
  hit: "Hit",
  stand: "Stand",
  double: "Double",
  split: "Split",
  surrender: "Surrender",
  "insurance-no": "decline insurance",
  "even-money-no": "decline even money (play the 3:2)",
};

const CHIP_COLORS: Record<number, string> = {
  1: "#6e7f92",
  5: "#b3282d",
  25: "#1e6b3c",
  100: "#22303f",
  500: "#5b2a86",
  1000: "#8a6f1c",
};

/** Compact chip-stack rendering of a bet on the felt (desktop only). */
function BetChips({ amount }: { amount: number }) {
  const chips: number[] = [];
  let left = amount;
  for (const v of [1000, 500, 100, 25, 5, 1]) {
    while (left >= v && chips.length < 8) {
      chips.push(v);
      left -= v;
    }
  }
  if (chips.length === 0) return null;
  return (
    <span className="hidden items-center sm:flex" title={`${amount.toLocaleString()} chips`}>
      {chips.map((v, i) => (
        <span
          key={i}
          className="mini-chip"
          style={{ ["--chip-color" as string]: CHIP_COLORS[v] }}
        />
      ))}
      {left > 0 && <span className="ml-1 text-[10px] text-[var(--cream)]/40">+</span>}
    </span>
  );
}

interface CountInfo {
  runningCount: number;
  trueCount: number;
  decksRemaining: number;
}

/**
 * Hi-Lo count, visualized: color-coded running/true count, a hot–cold meter
 * for the true count, shoe depletion, and what the count means for your bet.
 */
function CountPanel({ count }: { count: CountInfo }) {
  const tc = count.trueCount;
  const mood = tc >= 2 ? "hot" : tc <= -1 ? "cold" : "even";
  const color =
    mood === "hot" ? "text-emerald-300" : mood === "cold" ? "text-red-300" : "text-[var(--cream)]/70";
  const advice =
    mood === "hot"
      ? "The shoe is rich in tens and aces — the book says bet bigger."
      : mood === "cold"
        ? "The shoe is rich in small cards — bet the table minimum."
        : "Neutral shoe — flat-bet the minimum.";
  const meterPct = ((Math.max(-5, Math.min(5, tc)) + 5) / 10) * 100;
  const shoePct = Math.max(4, Math.min(100, (count.decksRemaining / 6) * 100));
  return (
    <div
      className="gold-ring flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 font-mono text-[11px] tabular-nums"
      title={`Hi-Lo: running count ${count.runningCount > 0 ? "+" : ""}${count.runningCount}, true count ${tc > 0 ? "+" : ""}${tc} (running ÷ ${count.decksRemaining} decks left). ${advice}`}
    >
      <span className={color}>
        RC {count.runningCount > 0 ? "+" : ""}
        {count.runningCount}
      </span>
      <span className="text-[var(--cream)]/40">·</span>
      <span className={`font-bold ${color}`}>
        TC {tc > 0 ? "+" : ""}
        {tc}
      </span>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-gradient-to-r from-red-500/70 via-slate-500/40 to-emerald-400/70">
        <span
          className="absolute top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_5px_rgba(255,255,255,0.9)]"
          style={{ left: `${meterPct}%` }}
        />
      </span>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{mood}</span>
      <span
        className="flex items-center gap-1 text-[var(--cream)]/50"
        title={`${count.decksRemaining} of 6 decks left in the shoe`}
      >
        <span className="relative h-1.5 w-9 overflow-hidden rounded-full bg-black/70">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--gold)]/80"
            style={{ width: `${shoePct}%` }}
          />
        </span>
        {count.decksRemaining}d
      </span>
    </div>
  );
}

interface TableMin {
  min: number;
  label: string;
}

/**
 * Casino-style table sign — always on display: the Lucky Ladies progressive
 * jackpot ticker plus every paytable, rendered live from the engine's own
 * rules so the sign can't drift from what the table actually pays.
 * Vertical panel beside the felt on wide screens; compact expandable banner
 * above it on small ones.
 */
function TableSign({
  jackpot,
  tableMin,
  variant,
}: {
  jackpot: number | null;
  tableMin: TableMin;
  variant: Variant;
}) {
  const rules = rulesFor(variant);
  const pot = jackpot === null ? "—" : jackpot.toLocaleString();

  const PayRows = ({ rows }: { rows: [string, string][] }) => (
    <table className="w-full text-[11px]">
      <tbody>
        {rows.map(([hand, pays]) => (
          <tr key={hand} className="border-t border-white/5 first:border-t-0">
            <td className="py-1 pr-2 text-left text-[var(--cream)]/65">{hand}</td>
            <td className="py-1 text-right font-bold gold-text tabular-nums whitespace-nowrap">
              {pays}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const panel = (
    <div className="bj-sign">
      <div className="bj-sign-inner px-4 py-4">
        <p className="text-center font-display text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
          ♠ Blackjack Club
        </p>
        <div className="mt-3 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
            👑 Lucky Ladies
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--cream)]/50">
            Progressive Jackpot
          </p>
          <p className="mt-1 animate-pulse font-display text-3xl font-black gold-text tabular-nums">
            {pot}
          </p>
        </div>
        <PayRows
          rows={[
            ["Q♥ pair w/ dealer BJ", "JACKPOT"],
            ["Queen of Hearts pair", `${rules.llQueenOfHearts}:1`],
            ["Matched 20", `${rules.llMatched20}:1`],
            ["Suited 20", `${rules.llSuited20}:1`],
            ["Any 20", `${rules.llAny20}:1`],
          ]}
        />
        <p className="mt-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
          21+3
        </p>
        <PayRows
          rows={[
            ["Suited trips", `${rules.tpSuitedTrips}:1`],
            ["Straight flush", `${rules.tpStraightFlush}:1`],
            ["Three of a kind", `${rules.tpTrips}:1`],
            ["Straight", `${rules.tpStraight}:1`],
            ["Flush", `${rules.tpFlush}:1`],
          ]}
        />
        <p className="mt-3 font-display text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
          Perfect Pairs
        </p>
        <PayRows
          rows={[
            ["Perfect pair", `${rules.ppPerfect}:1`],
            ["Colored pair", `${rules.ppColored}:1`],
            ["Mixed pair", `${rules.ppMixed}:1`],
          ]}
        />
        <div className="mt-3 border-t border-white/10 pt-2 text-center text-[10px] leading-relaxed text-[var(--cream)]/55">
          <p className="font-semibold text-[var(--cream)]/70">
            MIN {tableMin.min.toLocaleString()} · {tableMin.label.toUpperCase()}
          </p>
          <p>
            {variant === "spanish21"
              ? "Spanish 21 · player 21 always wins"
              : "Blackjack pays 3 to 2"}{" "}
            · dealer stands on all 17s
          </p>
          <p className="text-[var(--cream)]/40">
            Side bets 1–{MAX_SIDE_BET} per hand · must place a Lucky Ladies wager to be
            eligible
          </p>
        </div>
      </div>
      <style>{`
        .bj-sign {
          border-radius: 18px;
          padding: 2.5px;
          background: linear-gradient(120deg,#ff5f6d,#ffc371,#47e891,#4aa8ff,#b06ab3,#ff5f6d);
          background-size: 400% 400%;
          animation: bj-sign-glow 9s linear infinite;
          box-shadow: 0 0 24px rgba(120,140,255,0.18), 0 0 8px rgba(255,120,180,0.15);
        }
        .bj-sign-inner {
          border-radius: 15.5px;
          background: linear-gradient(180deg,#131a26 0%,#0b101d 100%);
        }
        @keyframes bj-sign-glow {
          0% { background-position: 0% 50%; }
          100% { background-position: 400% 50%; }
        }
      `}</style>
    </div>
  );

  return (
    <div className="order-first w-full xl:order-none xl:w-64 xl:shrink-0 xl:self-start">
      {/* compact always-visible banner on small screens, expandable to the full sign */}
      <details className="mb-3 xl:hidden">
        <summary className="bj-sign block cursor-pointer list-none">
          <div className="bj-sign-inner flex items-center justify-between px-4 py-2">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--gold-bright)]">
              👑 Lucky Ladies Jackpot
            </span>
            <span className="animate-pulse font-display text-lg font-black gold-text tabular-nums">
              {pot}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--cream)]/50">
              paytables ▾
            </span>
          </div>
        </summary>
        <div className="mt-2">{panel}</div>
      </details>
      {/* full vertical sign beside the felt on wide screens */}
      <div className="hidden xl:block">{panel}</div>
    </div>
  );
}

interface TableState {
  chips: number;
  bonusAvailable: boolean;
  round: ClientView | null;
  tableMin?: TableMin;
  dealerTips?: number;
  jackpot?: number;
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
    view.hands.reduce((sum, h) => sum + h.cards.length, 0) +
    (view.bots?.reduce((sum, b) => sum + b.cards.length, 0) ?? 0) +
    view.dealer.cards.length
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
  const [variant, setVariant] = useState<Variant>("classic");
  const [botCount, setBotCount] = useState(0);
  const [showCount, setShowCount] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [ppBet, setPpBet] = useState(0);
  const [tpBet, setTpBet] = useState(0);
  const [llBet, setLlBet] = useState(0);
  const [trainer, setTrainer] = useState(false);
  const [trainerStats, setTrainerStats] = useState<TrainerStats>(EMPTY_TRAINER_STATS);
  const [jackpot, setJackpot] = useState<number | null>(null);
  /** Per-seat opt-out for the strategy guide (master lightbulb still rules). */
  const [handHints, setHandHints] = useState<boolean[]>([true, true, true]);
  const [showSign, setShowSign] = useState(true);
  const [tips, setTips] = useState(0);
  const [tableMin, setTableMin] = useState<TableMin>({ min: 15, label: "standard rates" });
  /** Last-seen Hi-Lo values — kept so the pill survives between rounds. */
  const [count, setCount] = useState<CountInfo | null>(null);

  useEffect(() => {
    setMuted(sounds.muted);
    const v = localStorage.getItem(VARIANT_KEY);
    if (v === "spanish21") setVariant(v);
    const b = parseInt(localStorage.getItem(BOTS_KEY) ?? "0", 10);
    if (Number.isInteger(b) && b >= 0 && b <= MAX_BOTS) setBotCount(b);
    setShowCount(localStorage.getItem(SHOW_COUNT_KEY) === "1");
    setShowHints(localStorage.getItem(SHOW_HINTS_KEY) === "1");
    setTrainer(localStorage.getItem(TRAINER_KEY) === "1");
    setTrainerStats(loadTrainerStats());
    setShowSign(localStorage.getItem(SHOW_SIGN_KEY) !== "0");
    try {
      const hh = JSON.parse(localStorage.getItem(HAND_HINTS_KEY) ?? "");
      if (
        Array.isArray(hh) &&
        hh.length >= 3 &&
        hh.length <= 6 &&
        hh.every((v) => typeof v === "boolean")
      ) {
        setHandHints(hh);
      }
    } catch {
      /* default: hints on for every seat */
    }
  }, []);

  useEffect(() => {
    api<TableState>("/api/game/state")
      .then((s) => {
        setChips(s.chips);
        setBonusAvailable(s.bonusAvailable);
        setRound(s.round);
        if (s.tableMin) setTableMin(s.tableMin);
        setTips(s.dealerTips ?? 0);
        if (typeof s.jackpot === "number") setJackpot(s.jackpot);
        if (s.round) {
          setCount({
            runningCount: s.round.runningCount,
            trueCount: s.round.trueCount,
            decksRemaining: s.round.decksRemaining,
          });
        }
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const applyResponse = useCallback((r: { chips: number; round: ClientView }) => {
    setChips(r.chips);
    setRound(r.round);
    setCount({
      runningCount: r.round.runningCount,
      trueCount: r.round.trueCount,
      decksRemaining: r.round.decksRemaining,
    });
  }, []);

  async function tipDealer(amount: number) {
    setBusy(true);
    try {
      const r = await api<{ chips: number; dealerTips: number }>("/api/game/tip", { amount });
      setChips(r.chips);
      setTips(r.dealerTips);
      sounds.coins();
      toast.success("🙏 The dealer says thanks!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deal() {
    if (pendingBet < tableMin.min) return;
    setBusy(true);
    try {
      const r = await api<{
        chips: number;
        round: ClientView;
        shuffled?: boolean;
        jackpot?: number;
        jackpotWon?: number;
      }>("/api/game/bet", {
        bet: pendingBet,
        hands: seats,
        variant,
        bots: botCount,
        perfectPairs: ppBet,
        twentyOnePlusThree: tpBet,
        luckyLadies: llBet,
      });
      if (r.shuffled) {
        // Hold the response while the shuffle plays, then deal as usual
        setShuffling(true);
        sounds.shuffle();
        await new Promise((resolve) => setTimeout(resolve, SHUFFLE_MS));
        setShuffling(false);
      }
      applyResponse(r);
      if (typeof r.jackpot === "number") setJackpot(r.jackpot);
      if ((r.jackpotWon ?? 0) > 0) celebrateJackpot(r.jackpotWon!);
      // Opening deal: two cards per seat and bot, plus the dealer's two
      const dealt = (seats + (r.round.bots?.length ?? 0)) * 2 + 2;
      for (let i = 0; i < dealt; i++) sounds.deal(i * 0.13);
      // Side bet hits are paid on the spot — celebrate right after the deal
      if (
        r.round.hands.some(
          (h) =>
            (h.pp?.payout ?? 0) > 0 ||
            (h.tp?.payout ?? 0) > 0 ||
            (h.ll?.payout ?? 0) > 0
        )
      ) {
        sounds.sideBet(dealt * 0.13 + 0.15);
      }
      if (r.round.phase === "settled") playResult(r.round, dealt * 0.13 + 0.3);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Per-seat opt-in/out for the on-screen strategy guide. Splits can push
   * hand indexes past the stored 3 seats — missing entries default to ON.
   */
  function toggleHandHint(i: number) {
    setHandHints((prev) => {
      const next = [...prev];
      next[i] = !(next[i] ?? true);
      localStorage.setItem(HAND_HINTS_KEY, JSON.stringify(next));
      return next;
    });
    sounds.chip();
  }

  /** The rarest moment in the club: Queen of Hearts pair + dealer blackjack. */
  function celebrateJackpot(amount: number) {
    sounds.blackjack(0.2);
    sounds.coins(0.6);
    toast.success(
      `👑 LUCKY LADIES JACKPOT! Queen of Hearts pair + dealer blackjack pays the whole pot: +${amount.toLocaleString()} chips`,
      { duration: 12000 }
    );
  }

  /**
   * Trainer: grade a decision against basic strategy once the table accepts
   * it. BLIND-ONLY SCORING — the scorecard counts a decision only when the
   * guide was hidden for it (`scored`); a mistake gets coached either way.
   */
  function gradeDecision(
    action: PlayerAction,
    expected: PlayerAction,
    reason: string | null,
    scored: boolean
  ) {
    const correct = action === expected;
    if (scored) {
      const next: TrainerStats = {
        right: trainerStats.right + (correct ? 1 : 0),
        wrong: trainerStats.wrong + (correct ? 0 : 1),
        streak: correct ? trainerStats.streak + 1 : 0,
        best: correct
          ? Math.max(trainerStats.best, trainerStats.streak + 1)
          : trainerStats.best,
      };
      setTrainerStats(next);
      localStorage.setItem(TRAINER_STATS_KEY, JSON.stringify(next));
      if (
        correct &&
        ([5, 10, 25, 50].includes(next.streak) ||
          (next.streak > 0 && next.streak % 100 === 0))
      ) {
        toast.success(`🔥 ${next.streak} correct blind plays in a row!`);
      }
    }
    if (!correct) {
      toast.warning(
        `Coach: ${ACTION_LABELS[expected] ?? expected} was the play. ${reason ?? ""}`,
        { duration: 6000 }
      );
    }
  }

  async function act(action: PlayerAction) {
    setBusy(true);
    const before = visibleCards(round);
    // Snapshot the pre-action hint so the grade survives the state update —
    // but only count it once the server actually accepts the play
    const expected = trainer ? (round?.hint ?? null) : null;
    const reason = round?.hintReason ?? null;
    // Was the guide on screen for this decision? Insurance/even-money prompts
    // show it with the master lightbulb; regular actions also honor the
    // per-hand bulb. Visible guide → coached but not scored.
    const hintVisible =
      showHints &&
      (round?.phase === "insurance" || (handHints[round?.active ?? 0] ?? true));
    try {
      const r = await api<{ chips: number; round: ClientView; jackpotWon?: number }>(
        "/api/game/action",
        { action }
      );
      if (expected) gradeDecision(action, expected, reason, !hintVisible);
      applyResponse(r);
      if ((r.jackpotWon ?? 0) > 0) celebrateJackpot(r.jackpotWon!);
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
  const broke = chips !== null && chips < tableMin.min && betting;
  // Mid-round the table shows the round's variant; between rounds, the picker's
  const tableVariant = round?.variant ?? variant;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 pb-6 xl:max-w-6xl xl:flex-row xl:items-stretch xl:gap-5">
      <div className="flex w-full min-w-0 flex-1 flex-col">
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
          {showCount && count && <CountPanel count={count} />}
          <button
            onClick={() => {
              const next = !showSign;
              setShowSign(next);
              localStorage.setItem(SHOW_SIGN_KEY, next ? "1" : "0");
              sounds.chip();
            }}
            className={`gold-ring flex h-9 w-9 items-center justify-center rounded-full bg-black/40 transition-colors hover:text-[var(--gold-bright)] ${
              showSign ? "text-[var(--gold-bright)]" : "text-[var(--cream)]/60"
            }`}
            title={showSign ? "Hide the table sign" : "Show the table sign (jackpot + paytables)"}
            aria-label={showSign ? "Hide table sign" : "Show table sign"}
          >
            <Crown className="h-4 w-4" />
          </button>
          {trainer && (
            <div
              className="gold-ring flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 font-mono text-xs tabular-nums"
              title="Trainer scorecard — blind decisions only (guide hidden): correct · mistakes · accuracy · current streak (best)"
            >
              <span className="text-emerald-300/90">{trainerStats.right}✓</span>
              <span className="text-red-300/80">{trainerStats.wrong}✕</span>
              {trainerStats.right + trainerStats.wrong > 0 && (
                <>
                  <span className="text-[var(--cream)]/40">·</span>
                  <span className="text-[var(--gold-bright)]">
                    {Math.round(
                      (trainerStats.right / (trainerStats.right + trainerStats.wrong)) * 100
                    )}
                    %
                  </span>
                  <span className="text-[var(--cream)]/40">·</span>
                  <span className="text-[var(--cream)]/70">
                    🔥{trainerStats.streak}
                    <span className="text-[var(--cream)]/40"> ({trainerStats.best})</span>
                  </span>
                </>
              )}
              <button
                onClick={() => {
                  setTrainerStats(EMPTY_TRAINER_STATS);
                  localStorage.setItem(TRAINER_STATS_KEY, JSON.stringify(EMPTY_TRAINER_STATS));
                  sounds.chip();
                  toast.success("Trainer scorecard reset");
                }}
                className="ml-0.5 text-[var(--cream)]/40 transition-colors hover:text-[var(--gold-bright)]"
                title="Reset trainer scorecard"
                aria-label="Reset trainer scorecard"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => {
              const next = !trainer;
              setTrainer(next);
              localStorage.setItem(TRAINER_KEY, next ? "1" : "0");
              sounds.chip();
              if (next) {
                toast.success(
                  "Trainer on — decisions made with the guide hidden build your scorecard; mistakes get coached either way. Turn the lightbulb off for the real test."
                );
              }
            }}
            className={`gold-ring flex h-9 w-9 items-center justify-center rounded-full bg-black/40 transition-colors hover:text-[var(--gold-bright)] ${
              trainer ? "text-[var(--gold-bright)]" : "text-[var(--cream)]/60"
            }`}
            title={
              trainer
                ? "Trainer on — decisions are graded against basic strategy"
                : "Turn on the strategy trainer (grades every play, coaches mistakes)"
            }
            aria-label={trainer ? "Turn off strategy trainer" : "Turn on strategy trainer"}
          >
            <GraduationCap className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const next = !showHints;
              setShowHints(next);
              localStorage.setItem(SHOW_HINTS_KEY, next ? "1" : "0");
              sounds.chip();
            }}
            className={`gold-ring flex h-9 w-9 items-center justify-center rounded-full bg-black/40 transition-colors hover:text-[var(--gold-bright)] ${
              showHints ? "text-[var(--gold-bright)]" : "text-[var(--cream)]/60"
            }`}
            title={showHints ? "Hide strategy hints" : "Show basic-strategy hints"}
            aria-label={showHints ? "Hide strategy hints" : "Show strategy hints"}
          >
            <Lightbulb className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const next = !showCount;
              setShowCount(next);
              localStorage.setItem(SHOW_COUNT_KEY, next ? "1" : "0");
              sounds.chip();
            }}
            className="gold-ring flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-[var(--cream)]/60 transition-colors hover:text-[var(--gold-bright)]"
            title={showCount ? "Hide card count" : "Show card count (Hi-Lo)"}
            aria-label={showCount ? "Hide card count" : "Show card count"}
          >
            {showCount ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
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
      <div className="felt-table relative flex flex-1 flex-col rounded-[46%_46%_38px_38px/90px_90px_38px_38px] px-2 pb-5 pt-6 sm:px-10 sm:pb-6 sm:pt-8">
        {shuffling && (
          <div className="shuffle-overlay">
            <div className="shuffle-stack">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="shuffle-card pcard-back" />
              ))}
            </div>
            <p className="text-xs uppercase tracking-[0.4em] text-[var(--cream)]/70">
              Shuffling
            </p>
          </div>
        )}
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
                {tips > 0 && (
                  <span
                    className="ml-3 tracking-normal text-[var(--cream)]/40 normal-case"
                    title="Your lifetime dealer tips"
                  >
                    🪙 tips {tips.toLocaleString()}
                  </span>
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
                    {tableVariant === "spanish21"
                      ? "SPANISH 21 · PAYS 3 TO 2"
                      : "BLACKJACK PAYS 3 TO 2"}
                  </textPath>
                </text>
                <text fontSize="12" fill="rgba(246,238,218,0.55)" letterSpacing="2">
                  <textPath href="#arc2" startOffset="50%" textAnchor="middle">
                    {tableVariant === "spanish21"
                      ? "48-CARD DECKS · 21 ALWAYS WINS · SURRENDER · BONUS 21s"
                      : "SIX DECKS · DEALER STANDS ON ALL 17s · INSURANCE 2:1"}
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
                        <BetChips amount={hand.bet} />
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
                                : hand.outcome === "push" || hand.outcome === "surrender"
                                  ? "bg-black/40 text-[var(--cream-dim)]"
                                  : "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                            }`}
                          >
                            {hand.bonus
                              ? `${hand.bonus}!`
                              : hand.outcome === "blackjack"
                                ? "Blackjack!"
                                : hand.outcome === "even-money"
                                  ? "Even Money ✓"
                                  : hand.outcome}
                          </span>
                        )}
                        {hand.pp && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              hand.pp.payout > 0
                                ? "sidebet-win bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                                : "bg-black/40 text-[var(--cream-dim)]"
                            }`}
                            title={`Perfect Pairs: ${hand.pp.label} — paid instantly`}
                          >
                            {hand.pp.payout > 0
                              ? `💎 ${hand.pp.label} +${(hand.pp.payout - hand.pp.bet).toLocaleString()}`
                              : "Pairs ✕"}
                          </span>
                        )}
                        {hand.tp && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              hand.tp.payout > 0
                                ? "sidebet-win bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                                : "bg-black/40 text-[var(--cream-dim)]"
                            }`}
                            title={`21+3: ${hand.tp.label} — paid instantly`}
                          >
                            {hand.tp.payout > 0
                              ? `♠ ${hand.tp.label} +${(hand.tp.payout - hand.tp.bet).toLocaleString()}`
                              : "21+3 ✕"}
                          </span>
                        )}
                        {hand.ll && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              hand.llJackpot
                                ? "sidebet-win bg-[var(--gold)]/40 text-[var(--gold-bright)]"
                                : hand.ll.payout > 0
                                  ? "sidebet-win bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                                  : "bg-black/40 text-[var(--cream-dim)]"
                            }`}
                            title={
                              hand.llJackpot
                                ? "Lucky Ladies PROGRESSIVE JACKPOT — Queen of Hearts pair + dealer blackjack!"
                                : `Lucky Ladies: ${hand.ll.label} — paid instantly`
                            }
                          >
                            {hand.llJackpot
                              ? "👑 JACKPOT!"
                              : hand.ll.payout > 0
                                ? `👑 ${hand.ll.label} +${(hand.ll.payout - hand.ll.bet).toLocaleString()}`
                                : "Ladies ✕"}
                          </span>
                        )}
                        {!settled && showHints && (
                          <button
                            onClick={() => toggleHandHint(hi)}
                            className={`transition-colors ${
                              (handHints[hi] ?? true)
                                ? "text-[var(--gold-bright)]"
                                : "text-[var(--cream)]/35 hover:text-[var(--cream)]/60"
                            }`}
                            title={
                              (handHints[hi] ?? true)
                                ? "Strategy guide ON for this hand — click to hide"
                                : "Strategy guide OFF for this hand — click to show"
                            }
                            aria-label={`Toggle strategy guide for hand ${hi + 1}`}
                          >
                            {(handHints[hi] ?? true) ? (
                              <Lightbulb className="h-3.5 w-3.5" />
                            ) : (
                              <LightbulbOff className="h-3.5 w-3.5" />
                            )}
                          </button>
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

              {/* simulated players */}
              {round?.bots?.map((bot) => (
                <div
                  key={bot.name}
                  className="flex scale-[0.85] flex-col items-center gap-2 rounded-2xl p-3 opacity-90"
                >
                  <div className="flex gap-2">
                    {bot.cards.map((card, ci) => (
                      <PlayingCard
                        key={`b-${bot.name}-${ci}-${card.rank}${card.suit}`}
                        card={card}
                        dealDelay={ci * 150}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/60">
                      {bot.name}
                    </span>
                    <span className="font-semibold text-[var(--cream)]/70 tabular-nums">
                      {bot.total}
                    </span>
                    <span className="text-[var(--cream)]/40 tabular-nums">bet {bot.bet}</span>
                    {bot.doubled && (
                      <span className="rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--gold-bright)]">
                        2×
                      </span>
                    )}
                    {bot.outcome && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          bot.outcome === "lose"
                            ? "bg-red-900/60 text-red-200"
                            : bot.outcome === "push" || bot.outcome === "surrender"
                              ? "bg-black/40 text-[var(--cream-dim)]"
                              : "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                        }`}
                      >
                        {bot.outcome === "blackjack" ? "Blackjack!" : bot.outcome}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* result banner */}
            {settled && round && (
              <ResultBanner
                net={round.netResult ?? 0}
                onNext={newHand}
                disabled={busy}
                chips={chips ?? 0}
                onTip={tipDealer}
              />
            )}

            {/* controls */}
            <div className="mt-auto pt-4">
              {round?.phase === "insurance" ? (
                round.actions.includes("even-money-yes") ? (
                  <EvenMoneyPrompt
                    bet={round.baseBet}
                    onAnswer={(yes) => act(yes ? "even-money-yes" : "even-money-no")}
                    disabled={busy}
                    showHint={showHints}
                  />
                ) : (
                  <InsurancePrompt
                    cost={round.insuranceCost}
                    onAnswer={(yes) => act(yes ? "insurance-yes" : "insurance-no")}
                    disabled={busy}
                    canAfford={(chips ?? 0) >= round.insuranceCost}
                    showHint={showHints}
                  />
                )
              ) : round && !settled ? (
                <ActionBar
                  actions={round.actions}
                  chips={chips ?? 0}
                  handBet={round.hands[round.active]?.bet ?? 0}
                  onAction={act}
                  disabled={busy}
                  hint={
                    showHints && (handHints[round.active] ?? true)
                      ? (round.hint ?? null)
                      : null
                  }
                  hintReason={
                    showHints && (handHints[round.active] ?? true)
                      ? (round.hintReason ?? null)
                      : null
                  }
                />
              ) : betting && !settled ? (
                <BetPicker
                  chips={chips ?? 0}
                  pending={pendingBet}
                  seats={seats}
                  variant={variant}
                  botCount={botCount}
                  tableMin={tableMin}
                  pp={ppBet}
                  onPp={(v) => {
                    sounds.chip();
                    setPpBet(v);
                  }}
                  tp={tpBet}
                  onTp={(v) => {
                    sounds.chip();
                    setTpBet(v);
                  }}
                  ll={llBet}
                  onLl={(v) => {
                    sounds.chip();
                    setLlBet(v);
                  }}
                  onVariant={(v) => {
                    sounds.chip();
                    setVariant(v);
                    localStorage.setItem(VARIANT_KEY, v);
                  }}
                  onBots={(n) => {
                    sounds.chip();
                    setBotCount(n);
                    localStorage.setItem(BOTS_KEY, String(n));
                  }}
                  onSeats={(n) => {
                    sounds.chip();
                    setSeats(n);
                  }}
                  onAdd={(v) => {
                    sounds.chip();
                    setPendingBet((p) =>
                      Math.min(
                        p + v,
                        MAX_BET,
                        Math.floor((chips ?? 0) / seats) - ppBet - tpBet - llBet
                      )
                    );
                  }}
                  onAllIn={() => {
                    sounds.coins();
                    setPendingBet(
                      Math.min(
                        Math.floor((chips ?? 0) / seats) - ppBet - tpBet - llBet,
                        MAX_BET
                      )
                    );
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
      {showSign && (
        <TableSign jackpot={jackpot} tableMin={tableMin} variant={tableVariant} />
      )}
    </div>
  );
}

function ResultBanner({
  net,
  onNext,
  disabled,
  chips,
  onTip,
}: {
  net: number;
  onNext: () => void;
  disabled: boolean;
  chips: number;
  onTip: (amount: number) => void;
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
      <div className="flex items-center gap-1.5 text-xs text-[var(--cream)]/50">
        <HandCoins className="h-3.5 w-3.5" />
        Tip the dealer
        {TIP_VALUES.map((v) => (
          <button
            key={v}
            onClick={() => onTip(v)}
            disabled={disabled || chips < v}
            className="rounded-full border border-[var(--gold)]/40 px-2 py-0.5 font-mono text-[11px] text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/15 disabled:opacity-35"
          >
            +{v}
          </button>
        ))}
      </div>
      <button className="action-btn primary mt-1" onClick={onNext} disabled={disabled}>
        New Hand
      </button>
    </div>
  );
}

function EvenMoneyPrompt({
  bet,
  onAnswer,
  disabled,
  showHint,
}: {
  bet: number;
  onAnswer: (yes: boolean) => void;
  disabled: boolean;
  showHint?: boolean;
}) {
  return (
    <div className="fade-up mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-black/35 p-4 gold-ring">
      <p className="font-display text-lg font-bold gold-text tracking-wide">
        Blackjack! Even money?
      </p>
      <p className="text-xs text-[var(--cream)]/60">
        The dealer is showing an ace. Take a guaranteed {bet.toLocaleString()} (1:1) right
        now — or play it out for the 3:2 payout and risk a push if the dealer also has
        blackjack.
      </p>
      {showHint && (
        <p className="flex items-center gap-1 text-xs text-[var(--gold-bright)]/80">
          <Lightbulb className="h-3 w-3" /> Basic strategy: decline — 3:2 wins more in the long run
        </p>
      )}
      <div className="flex gap-3">
        <button className="action-btn" onClick={() => onAnswer(true)} disabled={disabled}>
          Take Even Money (+{bet.toLocaleString()})
        </button>
        <button className="action-btn primary" onClick={() => onAnswer(false)} disabled={disabled}>
          Play It Out
        </button>
      </div>
    </div>
  );
}

function InsurancePrompt({
  cost,
  onAnswer,
  disabled,
  canAfford,
  showHint,
}: {
  cost: number;
  onAnswer: (yes: boolean) => void;
  disabled: boolean;
  canAfford: boolean;
  showHint?: boolean;
}) {
  return (
    <div className="fade-up mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-black/35 p-4 gold-ring">
      <p className="font-display text-lg font-bold gold-text tracking-wide">Insurance?</p>
      <p className="text-xs text-[var(--cream)]/60">
        The dealer is showing an ace. Insurance costs {cost} chips and pays 2 to 1 on a dealer blackjack.
      </p>
      {showHint && (
        <p className="flex items-center gap-1 text-xs text-[var(--gold-bright)]/80">
          <Lightbulb className="h-3 w-3" /> Basic strategy: always decline insurance
        </p>
      )}
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
  hint,
  hintReason,
}: {
  actions: PlayerAction[];
  chips: number;
  handBet: number;
  onAction: (a: PlayerAction) => void;
  disabled: boolean;
  hint?: PlayerAction | null;
  hintReason?: string | null;
}) {
  const canAffordExtra = chips >= handBet;
  const hintRing =
    "shadow-[0_0_0_2px_var(--gold-bright),0_0_16px_rgba(236,201,94,0.45)]";
  return (
    <div className="fade-up flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {actions.includes("hit") && (
          <button
            className={`action-btn primary ${hint === "hit" ? hintRing : ""}`}
            onClick={() => onAction("hit")}
            disabled={disabled}
          >
            Hit
          </button>
        )}
        {actions.includes("stand") && (
          <button
            className={`action-btn ${hint === "stand" ? hintRing : ""}`}
            onClick={() => onAction("stand")}
            disabled={disabled}
          >
            Stand
          </button>
        )}
        {actions.includes("double") && (
          <button
            className={`action-btn ${hint === "double" ? hintRing : ""}`}
            onClick={() => onAction("double")}
            disabled={disabled || !canAffordExtra}
            title={canAffordExtra ? undefined : "Not enough chips to double"}
          >
            Double
          </button>
        )}
        {actions.includes("split") && (
          <button
            className={`action-btn ${hint === "split" ? hintRing : ""}`}
            onClick={() => onAction("split")}
            disabled={disabled || !canAffordExtra}
            title={canAffordExtra ? undefined : "Not enough chips to split"}
          >
            Split
          </button>
        )}
        {actions.includes("surrender") && (
          <button
            className={`action-btn ${hint === "surrender" ? hintRing : ""}`}
            onClick={() => onAction("surrender")}
            disabled={disabled}
            title="Give up this hand and get half your bet back"
          >
            Surrender
          </button>
        )}
      </div>
      {hint && (
        <div className="flex max-w-md flex-col items-center gap-0.5 text-center">
          <p className="flex items-center gap-1 text-xs text-[var(--gold-bright)]/80">
            <Lightbulb className="h-3 w-3" /> Basic strategy says: {ACTION_LABELS[hint] ?? hint}
          </p>
          {hintReason && (
            <p className="text-[11px] leading-snug text-[var(--cream)]/50">{hintReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BetPicker({
  chips,
  pending,
  seats,
  variant,
  botCount,
  tableMin,
  pp,
  onPp,
  tp,
  onTp,
  ll,
  onLl,
  onSeats,
  onVariant,
  onBots,
  onAdd,
  onAllIn,
  onClear,
  onDeal,
  disabled,
}: {
  chips: number;
  pending: number;
  seats: number;
  variant: Variant;
  botCount: number;
  tableMin: TableMin;
  pp: number;
  onPp: (v: number) => void;
  tp: number;
  onTp: (v: number) => void;
  ll: number;
  onLl: (v: number) => void;
  onSeats: (n: number) => void;
  onVariant: (v: Variant) => void;
  onBots: (n: number) => void;
  onAdd: (v: number) => void;
  onAllIn: () => void;
  onClear: () => void;
  onDeal: () => void;
  disabled: boolean;
}) {
  const total = (pending + pp + tp + ll) * seats;
  const sides = pp + tp + ll;
  const allInAmount = Math.floor(chips / seats) - sides;
  const isAllIn = pending > 0 && pending === allInAmount;
  return (
    <div className="fade-up flex flex-col items-center gap-4">
      <div className="text-[11px] uppercase tracking-[0.25em] text-[var(--cream)]/50">
        Table minimum{" "}
        <span className="font-semibold text-[var(--gold-bright)]">{tableMin.min}</span>
        {" · "}
        {tableMin.label}
        {" · "}
        <a
          href="/how-to-play"
          className="normal-case tracking-normal text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline"
        >
          rules &amp; payouts →
        </a>
      </div>
      <div className="flex items-end gap-2 sm:gap-3">
        {CHIP_VALUES.map((v) => (
          <button
            key={v}
            className={`chip-btn chip-${v}`}
            onClick={() => onAdd(v)}
            disabled={disabled || pending + v > MAX_BET || (pending + v + sides) * seats > chips}
            aria-label={`Add ${v} chip`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* side bets */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/30 px-3 py-1.5 gold-ring">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/50"
            title="Your first two cards as a pair: mixed 5:1 · colored 10:1 · perfect 30:1"
          >
            Perfect Pairs <span className="text-[var(--cream)]/30">$1 min</span>
          </span>
          {SIDE_CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => onPp(Math.min(pp + v, MAX_SIDE_BET))}
              disabled={disabled || pp + v > MAX_SIDE_BET || (pending + sides + v) * seats > chips}
              className="rounded-full border border-[var(--gold)]/40 px-2.5 py-0.5 text-[11px] font-mono text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/15 disabled:opacity-35"
            >
              +{v}
            </button>
          ))}
          <span className="min-w-8 text-center font-mono text-sm font-bold gold-text tabular-nums">
            {pp}
          </span>
          {pp > 0 && (
            <button
              onClick={() => onPp(0)}
              disabled={disabled}
              className="text-[11px] text-[var(--cream)]/40 underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/30 px-3 py-1.5 gold-ring">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/50"
            title="Your two cards + dealer upcard as 3-card poker: flush 5:1 · straight 10:1 · trips 30:1 · straight flush 40:1 · suited trips 100:1"
          >
            21+3 <span className="text-[var(--cream)]/30">$1 min</span>
          </span>
          {SIDE_CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => onTp(Math.min(tp + v, MAX_SIDE_BET))}
              disabled={disabled || tp + v > MAX_SIDE_BET || (pending + sides + v) * seats > chips}
              className="rounded-full border border-[var(--gold)]/40 px-2.5 py-0.5 text-[11px] font-mono text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/15 disabled:opacity-35"
            >
              +{v}
            </button>
          ))}
          <span className="min-w-8 text-center font-mono text-sm font-bold gold-text tabular-nums">
            {tp}
          </span>
          {tp > 0 && (
            <button
              onClick={() => onTp(0)}
              disabled={disabled}
              className="text-[11px] text-[var(--cream)]/40 underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-black/30 px-3 py-1.5 gold-ring">
          <span
            className="text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/50"
            title="Your first two cards totaling 20: any 20 4:1 · suited 20 9:1 · matched 20 19:1 · Queen of Hearts pair 125:1 · QoH pair + dealer blackjack wins the PROGRESSIVE JACKPOT"
          >
            👑 Lucky Ladies <span className="text-[var(--cream)]/30">$1 min</span>
          </span>
          {SIDE_CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => onLl(Math.min(ll + v, MAX_SIDE_BET))}
              disabled={disabled || ll + v > MAX_SIDE_BET || (pending + sides + v) * seats > chips}
              className="rounded-full border border-[var(--gold)]/40 px-2.5 py-0.5 text-[11px] font-mono text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/15 disabled:opacity-35"
            >
              +{v}
            </button>
          ))}
          <span className="min-w-8 text-center font-mono text-sm font-bold gold-text tabular-nums">
            {ll}
          </span>
          {ll > 0 && (
            <button
              onClick={() => onLl(0)}
              disabled={disabled}
              className="text-[11px] text-[var(--cream)]/40 underline-offset-2 hover:underline"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* table selectors */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 gold-ring">
          {(["classic", "spanish21"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onVariant(v)}
              disabled={disabled}
              className={`rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-35 ${
                variant === v
                  ? "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                  : "text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
              }`}
            >
              {v === "classic" ? "Classic" : "Spanish 21"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 gold-ring">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onSeats(n)}
              disabled={disabled || (n > 1 && pending * n > chips && pending > 0)}
              className={`rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-35 ${
                seats === n
                  ? "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                  : "text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
              }`}
            >
              {n === 1 ? "1 Hand" : `${n} Hands`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-black/30 p-1 gold-ring">
          <span className="pl-3 pr-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--cream)]/50">
            Bots
          </span>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onBots(n)}
              disabled={disabled}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-35 ${
                botCount === n
                  ? "bg-[var(--gold)]/25 text-[var(--gold-bright)]"
                  : "text-[var(--cream)]/50 hover:text-[var(--cream)]/80"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        <div className="min-w-24 text-center sm:min-w-28">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--cream)]/50">
            {seats > 1 ? `Bet × ${seats}` : "Bet"}
            {sides > 0 ? " + sides" : ""}
          </div>
          <div className="font-display text-2xl font-bold gold-text tabular-nums">
            {pending.toLocaleString()}
            {(seats > 1 || sides > 0) && (
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
          disabled={disabled || allInAmount < tableMin.min || isAllIn}
          title={`Bet your whole stack${seats > 1 ? ` (split across all ${seats} hands)` : ""}`}
        >
          All In
        </button>
        <button
          className="action-btn primary !px-10 !text-base"
          onClick={onDeal}
          disabled={disabled || pending < tableMin.min || total > chips}
        >
          Deal
        </button>
      </div>
      {chips < tableMin.min && (
        <p className="text-xs text-[var(--cream)]/50">
          You&apos;re out of chips — claim the house stake above to keep playing.
        </p>
      )}
    </div>
  );
}
