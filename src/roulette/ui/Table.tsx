"use client";

import { useMemo } from "react";
import { COLS, ROWS, numAt } from "../engine/table";
import { pocketColor } from "../engine/wheel";
import type { BetSpot, PlacedBet, PocketId, SpinResult, WheelKind } from "../engine/types";

/** Chip denomination tier -> class, for coloring the placed-chip badge. */
function chipTier(amount: number): string {
  if (amount >= 500) return "chip--gold";
  if (amount >= 100) return "chip--blue";
  if (amount >= 25) return "chip--green";
  if (amount >= 5) return "chip--red";
  return "chip--white";
}

function Chip({ amount, win }: { amount: number; win?: boolean }) {
  return <span className={`chip ${chipTier(amount)} ${win ? "chip--win" : ""}`}>{amount}</span>;
}

export function Table({
  spots, bets, wheel, lastResult, onPlace,
}: {
  spots: BetSpot[];
  bets: Record<string, PlacedBet>;
  wheel: WheelKind;
  lastResult: SpinResult | null;
  onPlace: (spot: BetSpot) => void;
}) {
  const byKey = useMemo(() => new Map(spots.map((s) => [s.key, s])), [spots]);
  const won = useMemo(() => new Set(lastResult?.winningKeys ?? []), [lastResult]);
  const resultPocket: PocketId | null = lastResult?.pocket ?? null;

  const spot = (key: string) => byKey.get(key);
  const amt = (key: string) => bets[key]?.amount ?? 0;

  // A clickable cell for a straight/outside spot.
  const Cell = ({
    k, className, style, children,
  }: { k: string; className: string; style?: React.CSSProperties; children?: React.ReactNode }) => {
    const s = spot(k);
    if (!s) return null;
    const a = amt(k);
    const isResult = s.numbers.length === 1 && s.numbers[0] === resultPocket;
    return (
      <button
        className={`cell ${className} ${won.has(k) ? "cell--win" : ""} ${isResult ? "cell--result" : ""}`}
        style={style}
        onClick={() => onPlace(s)}
        aria-label={s.label ?? s.numbers.join(",")}
      >
        {children}
        {a > 0 && <Chip amount={a} win={won.has(k)} />}
      </button>
    );
  };

  const zeros: PocketId[] = wheel === "american" ? ["0", "00"] : ["0"];
  const comboSpots = spots.filter((s) => s.x !== undefined && s.y !== undefined);

  return (
    <div className="board">
      {/* Zero column */}
      <div className="board__zeros" style={{ gridRow: `1 / ${ROWS + 1}` }}>
        {zeros.map((z) => (
          <Cell key={z} k={`straight-${z}`} className="cell--num cell--green cell--zero">
            <span className="cell__n">{z}</span>
          </Cell>
        ))}
      </div>

      {/* 3 x 12 numbers */}
      {Array.from({ length: ROWS }).map((_, r) =>
        Array.from({ length: COLS }).map((__, c) => {
          const n = numAt(r, c);
          const color = pocketColor(String(n));
          return (
            <Cell
              key={n}
              k={`straight-${n}`}
              className={`cell--num cell--${color}`}
              style={{ gridColumn: c + 2, gridRow: r + 1 }}
            >
              <span className="cell__n">{n}</span>
            </Cell>
          );
        }),
      )}

      {/* 2:1 column bets on the right */}
      {["column-top", "column-mid", "column-bottom"].map((k, i) => (
        <Cell key={k} k={k} className="cell--outside cell--col" style={{ gridColumn: COLS + 2, gridRow: i + 1 }}>
          <span>2:1</span>
        </Cell>
      ))}

      {/* Dozens */}
      {["dozen-1", "dozen-2", "dozen-3"].map((k, i) => (
        <Cell
          key={k}
          k={k}
          className="cell--outside"
          style={{ gridColumn: `${2 + i * 4} / ${2 + i * 4 + 4}`, gridRow: ROWS + 1 }}
        >
          <span>{spot(k)?.label}</span>
        </Cell>
      ))}

      {/* Even-money row */}
      {["low", "even", "red", "black", "odd", "high"].map((k, i) => (
        <Cell
          key={k}
          k={k}
          className={`cell--outside ${k === "red" ? "cell--red" : ""} ${k === "black" ? "cell--black" : ""}`}
          style={{ gridColumn: `${2 + i * 2} / ${2 + i * 2 + 2}`, gridRow: ROWS + 2 }}
        >
          <span>{spot(k)?.label}</span>
        </Cell>
      ))}

      {/* Combo-bet overlay, aligned to the 12x3 number region */}
      <div className="board__overlay" style={{ gridColumn: `2 / ${COLS + 2}`, gridRow: `1 / ${ROWS + 1}` }}>
        {comboSpots.map((s) => {
          const a = amt(s.key);
          return (
            <button
              key={s.key}
              className={`hotspot hotspot--${s.kind} ${won.has(s.key) ? "hotspot--win" : ""} ${a > 0 ? "hotspot--set" : ""}`}
              style={{ left: `${s.x! * 100}%`, top: `${s.y! * 100}%` }}
              onClick={() => onPlace(s)}
              aria-label={`${s.kind} ${s.numbers.join(",")}`}
              title={`${s.kind} · ${s.numbers.join(", ")} · ${s.payout}:1`}
            >
              {a > 0 && <Chip amount={a} win={won.has(s.key)} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
