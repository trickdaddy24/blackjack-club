"use client";

import { useEffect, useRef } from "react";
import { pocketColor, wheelOrder } from "../engine/wheel";
import type { WheelKind } from "../engine/types";

const COLORS = {
  red: "#c1272d",
  black: "#1b1f2a",
  green: "#0f8a3c",
};
const EXTRA_SPINS = 6;
const DURATION_MS = 4200;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A canvas roulette wheel. On each `spinId` change it animates from its current
 * rotation, through several full turns, to land `targetIndex` under the fixed
 * pointer at the top, then calls `onDone` so the game can settle.
 */
export function Wheel({
  wheel, spinId, targetIndex, onDone, size = 300,
}: {
  wheel: WheelKind;
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

  const order = wheelOrder(wheel);
  const N = order.length;

  // Draw the wheel at a given rotation (radians, measured clockwise from top).
  const draw = (rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    // Outer gold rim.
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fillStyle = "#7a5a1e";
    ctx.fill();

    const rimInner = R - Math.max(10, size * 0.045);
    // Pockets.
    for (let j = 0; j < N; j++) {
      const center = -Math.PI / 2 + rot + j * seg; // canvas angle of pocket center
      const a0 = center - seg / 2;
      const a1 = center + seg / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rimInner, a0, a1);
      ctx.closePath();
      ctx.fillStyle = COLORS[pocketColor(order[j])];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Number label, rotated to sit along the radius.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(center);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(8, Math.round(size * 0.038))}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(order[j], rimInner * 0.82, 0);
      ctx.restore();
    }

    // Inner hub.
    ctx.beginPath();
    ctx.arc(cx, cy, rimInner * 0.42, 0, 2 * Math.PI);
    ctx.fillStyle = "#12182a";
    ctx.fill();
    ctx.strokeStyle = "#caa24a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, rimInner * 0.14, 0, 2 * Math.PI);
    ctx.fillStyle = "#caa24a";
    ctx.fill();

    // Ball + pointer at the very top (fixed, marks the landed pocket).
    ctx.beginPath();
    ctx.arc(cx, cy - rimInner * 0.9, Math.max(4, size * 0.02), 0, 2 * Math.PI);
    ctx.fillStyle = "#fefefe";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 8, 1);
    ctx.lineTo(cx + 8, 1);
    ctx.lineTo(cx, 14);
    ctx.closePath();
    ctx.fillStyle = "#caa24a";
    ctx.fill();
  };

  // Static (re)draw when the wheel kind or size changes.
  useEffect(() => {
    draw(rotation.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheel, size]);

  // Animate on each spin.
  useEffect(() => {
    if (spinId === 0) { draw(rotation.current); return; }
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

  return <canvas ref={canvasRef} width={size} height={size} className="wheel" style={{ width: size, height: size }} />;
}
