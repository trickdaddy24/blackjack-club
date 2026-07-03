# Changelog

All notable changes to Blackjack Club are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); the `VERSION` file is the source of truth.

---

## [0.2.0] — 2026-07-03

### Added
- **Sound effects** (`src/lib/sound.ts`) — synthesized with the Web Audio API, zero audio
  assets: chip clinks, card-swish deals (staggered with the animations), hole-card flip,
  win/blackjack fanfares, push, coin cascade for bonuses, and an arcade-style "death warble"
  on losses (Ms. Pac-Man homage). Mute toggle in the HUD, persisted to localStorage.
- **Two hands at once** — seat selector in the bet picker; the engine deals casino-style
  (seat 1, seat 2, dealer up, seat 1, seat 2, hole), hands play left to right, naturals lock
  automatically, insurance covers every seat at half the bet each. 5 new engine tests (40 total).
- **All In button** — bets the whole stack (split evenly across seats when playing two hands).
- **iPhone-friendly** — proper viewport (safe-area aware), compact cards/chips/buttons under
  480px, wrap-friendly hand layout, `touch-action: manipulation` + no tap highlight.

### Changed
- Bigger bankroll: **10,000** starting chips (existing players topped up), daily bonus
  **+2,500**, broke rescue **1,000**, table max raised so All In is a true all-in.
- New 1000-denomination chip in the bet picker.

---

## [0.1.0] — 2026-07-02

### Added
- **Full blackjack rules engine** (`src/lib/blackjack/engine.ts`) — pure, framework-free, server-authoritative:
  6-deck shoe with 75% penetration reshuffle, soft-ace hand values, dealer stands on all 17s,
  blackjack pays 3:2, US peek on ace/ten, insurance (2:1), split (equal rank, one re-split,
  split aces get one card), double on any first two cards including after split. 35 vitest tests.
- **Game API** (`/api/game/bet`, `/api/game/action`, `/api/game/state`) — session-gated,
  transactional chip debits/credits, round state persisted in SQLite (survives refresh),
  dealer hole card and shoe stripped from every response until reveal, illegal actions → 409.
- **Accounts & chips** — Auth.js v5 (credentials + optional Google), bcrypt cost 12,
  1,000 starting chips, daily bonus (+500 / 24h), broke rescue stake, `/api/bonus`.
- **The Midnight Table UI** — CSS-only felt table with curved gold imprint, CSS/SVG playing
  cards with deal/flip animations, casino chip bet picker, insurance prompt, result banner,
  split-hand rendering with active-hand glow.
- **Lobby** with top-5 chip leaderboard and house-rules cards; **profile** with hands played,
  win rate, biggest win, and recent-hands ledger.
- Deploy-ready scaffold: `output: "standalone"`, Dockerfile, `.env.example`. Dev port 7600.
