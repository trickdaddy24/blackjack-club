"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { mountPixelPlumber } from "@/mario/engine";
import "@/mario/mario.css";

export default function MarioPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const destroy = mountPixelPlumber(rootRef.current);
    return () => destroy();
  }, []);

  return (
    <div className="mario-app" ref={rootRef}>
      <div className="mario-shell">
        <header className="mario-topbar">
          <h1>PIXEL PLUMBER</h1>
          <Link className="mario-back" href="/">♠ Club</Link>
        </header>

        <div className="mario-hud">
          <div>SCORE <span className="mario-score">000000</span></div>
          <div>COINS <span className="mario-coins">0</span></div>
          <div>WORLD <span className="mario-world">1-1</span></div>
          <div>LIVES <span className="mario-lives">3</span></div>
          <div>TIME <span className="mario-time">400</span></div>
        </div>

        <div className="mario-canvas-wrap">
          <canvas className="mario-canvas" />
          <div className="mario-overlay hidden">
            <div className="mario-overlay-card">
              <h2 className="mario-overlay-title">Paused</h2>
              <p className="mario-overlay-sub"></p>
              <button className="mario-overlay-btn mario-btn">Resume</button>
            </div>
          </div>
        </div>

        <div className="mario-touch">
          <div className="mario-touch-left">
            <button className="tc-left tc-btn">◀</button>
            <button className="tc-right tc-btn">▶</button>
          </div>
          <div className="mario-touch-right">
            <button className="tc-run tc-btn tc-action">RUN</button>
            <button className="tc-jump tc-btn tc-action tc-jump">JUMP</button>
          </div>
        </div>

        <div className="mario-bottom-bar">
          <button className="mario-pause-btn mario-btn small">Pause</button>
          <button className="mario-sound-btn mario-btn small">Sound: On</button>
          <button className="mario-restart-btn mario-btn small">Restart</button>
        </div>

        <p className="mario-hint">Arrows/WASD to move · Z or Shift to run · Space/Up to jump · P to pause</p>
      </div>
    </div>
  );
}
