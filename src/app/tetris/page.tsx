"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { mountTetris } from "@/tetris/engine";
import "@/tetris/tetris.css";

export default function TetrisPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    const destroy = mountTetris(rootRef.current);
    return () => destroy();
  }, []);

  return (
    <div className="tetris-app" ref={rootRef}>
      <div className="tetris-shell">
        <header className="tetris-topbar">
          <h1>TETRIS</h1>
          <Link className="tetris-back" href="/">♠ Club</Link>
        </header>

        <div className="tetris-wrap">
          <aside className="tetris-panel tetris-panel--left">
            <div className="tetris-box">
              <div className="tetris-box-label">HOLD</div>
              <canvas className="tetris-hold" width={96} height={96} />
            </div>
            <div className="tetris-box tetris-stats">
              <div className="tetris-stat"><span className="tetris-stat-label">SCORE</span><span className="tetris-score tetris-stat-value">0</span></div>
              <div className="tetris-stat"><span className="tetris-stat-label">LINES</span><span className="tetris-lines tetris-stat-value">0</span></div>
              <div className="tetris-stat"><span className="tetris-stat-label">LEVEL</span><span className="tetris-level tetris-stat-value">1</span></div>
              <div className="tetris-stat"><span className="tetris-stat-label">BEST</span><span className="tetris-best tetris-stat-value">0</span></div>
            </div>
          </aside>

          <div className="tetris-board-col">
            <canvas className="tetris-board" />
            <div className="tetris-overlay hidden">
              <div className="tetris-overlay-card">
                <h2 className="tetris-overlay-title">Paused</h2>
                <p className="tetris-overlay-sub"></p>
                <button className="tetris-overlay-btn tetris-btn">Resume</button>
              </div>
            </div>
          </div>

          <aside className="tetris-panel tetris-panel--right">
            <div className="tetris-box">
              <div className="tetris-box-label">NEXT</div>
              <canvas className="tetris-next" width={96} height={280} />
            </div>
            <button className="tetris-pause-btn tetris-btn small">Pause</button>
            <button className="tetris-sound-btn tetris-btn small">Sound: On</button>
            <button className="tetris-restart-btn tetris-btn small">Restart</button>
          </aside>
        </div>

        <div className="tc-controls">
          <div className="tc-row">
            <button className="tc-hold tc-btn">Hold</button>
            <button className="tc-rotate tc-btn">⟳</button>
          </div>
          <div className="tc-row tc-dpad">
            <button className="tc-left tc-btn tc-arrow">◀</button>
            <button className="tc-down tc-btn tc-arrow">▼</button>
            <button className="tc-right tc-btn tc-arrow">▶</button>
          </div>
          <div className="tc-row">
            <button className="tc-drop tc-btn">HARD DROP</button>
          </div>
        </div>

        <p className="tetris-hint">Arrows to move · Up/X to rotate · Space to hard drop · C or Shift to hold · P to pause</p>
      </div>
    </div>
  );
}
