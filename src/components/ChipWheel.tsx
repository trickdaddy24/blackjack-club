"use client";

import { useEffect, useRef } from "react";

interface Segment {
  value: number;
  jackpot: boolean;
}

const REGULAR_COLORS = ["#3a2a12", "#4a3418"]; // alternating dark-gold tones
const JACKPOT_COLOR = "#b0203a";
const EXTRA_SPINS = 6;
const DURATION_MS = 4200;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A canvas chip wheel — adapted from the Roulette wheel's spin-to-target
 * animation (same easing/rotation math), restyled for chip-value segments
 * with one jackpot slice. On each `spinId` change it animates from its
 * current rotation, through several full turns, to land `targetIndex`
 * under the fixed pointer at the top, then calls `onDone`.
 */
export function ChipWheel({
  segments, spinId, targetIndex, onDone, size = 260,
}: {
  segments: Segment[];
  spinId: number;
  targetIndex: number;
  onDone: () => void;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotation = useRef(0);
  const raf = useRef<number | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const N = segments.length;

  const draw = (rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas || N === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 2;
    const seg = (2 * Math.PI) / N;

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fillStyle = "#7a5a1e";
    ctx.fill();

    const rimInner = R - Math.max(8, size * 0.035);
    for (let j = 0; j < N; j++) {
      const center = -Math.PI / 2 + rot + j * seg;
      const a0 = center - seg / 2;
      const a1 = center + seg / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rimInner, a0, a1);
      ctx.closePath();
      ctx.fillStyle = segments[j].jackpot ? JACKPOT_COLOR : REGULAR_COLORS[j % 2];
      ctx.fill();
      ctx.strokeStyle = "rgba(242, 193, 78, 0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(center);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = segments[j].jackpot ? "#ffe9a8" : "#f3e9d2";
      ctx.font = `${segments[j].jackpot ? "bold " : ""}${Math.max(8, Math.round(size * 0.036))}px ui-sans-serif, system-ui, sans-serif`;
      const label = segments[j].jackpot ? "★" : segments[j].value.toLocaleString();
      ctx.fillText(label, rimInner * 0.82, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, rimInner * 0.32, 0, 2 * Math.PI);
    ctx.fillStyle = "#12182a";
    ctx.fill();
    ctx.strokeStyle = "#f2c14e";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rimInner * 0.12, 0, 2 * Math.PI);
    ctx.fillStyle = "#f2c14e";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 8, 1);
    ctx.lineTo(cx + 8, 1);
    ctx.lineTo(cx, 14);
    ctx.closePath();
    ctx.fillStyle = "#f2c14e";
    ctx.fill();
  };

  useEffect(() => {
    draw(rotation.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length, size]);

  useEffect(() => {
    if (spinId === 0 || N === 0) { draw(rotation.current); return; }
    const seg = (2 * Math.PI) / N;
    const start = rotation.current;
    const curNorm = ((start % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const desired = ((-targetIndex * seg) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    let delta = desired - curNorm;
    if (delta <= 0) delta += 2 * Math.PI;
    const target = start + delta + EXTRA_SPINS * 2 * Math.PI;

    let startTs = 0;
    const step = (ts: number) => {
      if (!startTs) startTs = ts;
      const p = Math.min(1, (ts - startTs) / DURATION_MS);
      rotation.current = start + (target - start) * easeOutCubic(p);
      draw(rotation.current);
      if (p < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        rotation.current = target;
        draw(rotation.current);
        doneRef.current();
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);

  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />;
}
