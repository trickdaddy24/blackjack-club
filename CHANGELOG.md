# Changelog

All notable changes to Blackjack Club are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); the `VERSION` file is the source of truth.

---

## [0.7.0] — 2026-07-03

### Added
- **Leaderboard** (`/leaderboard`, members only) — top 10 chip stacks with crown/medal
  ranks, "you" highlight, and your own rank shown even outside the top 10.
- **How to Play** (`/how-to-play`, public) — full rules guide: hand actions, classic
  payouts, Spanish 21 differences + Bonus 21 paytable, Perfect Pairs paytable (rendered
  live from the engine's `rulesFor()`), Vegas-clock minimum schedule (shared
  `MINIMUM_SCHEDULE` constant), and table extras (bots, counter, tips, bonuses).
- TopBar links (Leaders + Rules) and a "rules & payouts →" link in the bet picker.

### Changed
- Version badge enlarged for readability (10px/30% → 14px/60%), both sites.
- `tableMinimum.ts` refactored around an exported `MINIMUM_SCHEDULE` so enforcement
  and the rules page can't drift apart.

## [0.6.0] — 2026-07-03

### Changed
- **Perfect Pairs replaces Match the Dealer** — your own first two cards as a pair:
  mixed 5:1, colored 10:1, perfect 30:1. Same $1 units / $100 cap / per seat; result
  badge shows the pair type. Legacy in-flight MTD rounds still pay out at settle.

### Added
- **$1 chip in the main rack** (blue-grey, Vegas style) — fine-tune any bet above the
  table minimum; the Perfect Pairs row keeps its $1/$5/$25 quick buttons ("$1 min" label).
- **Dealer tips** — +1/+5/+25 buttons on the result banner; chips move to a lifetime
  `dealerTips` counter (new User column, applied automatically by `db push` at boot)
  shown next to the dealer as "🪙 tips N". `POST /api/game/tip`.

## [0.5.1] — 2026-07-03

### Added
- Version badge at the bottom-left of the screen on both sites, baked from the
  `VERSION` file at build time (Next `env` / Vite `define`).

## [0.5.0] — 2026-07-03

### Added
- **Match the Dealer side bet** ($1 units, $100 cap, per seat) — either of your first two
  cards matching the dealer's upcard rank pays 4:1 unsuited, 11:1 suited (9:1 in
  Spanish 21); both cards matching pays both. Resolved instantly at the deal with an
  MTD badge on the hand. Hard Rock-style side-bet inspiration.
- **Vegas-style table minimums** — the floor changes on the Strip's clock (Pacific):
  $5 mornings (4am–noon), $15 afternoons (the standard table), $25 evenings
  (6pm–2am), $10 late night. Shown in the bet picker; enforced server-side; the
  broke-rescue threshold follows the current minimum.
- **Basic-strategy hints** — lightbulb toggle in the HUD highlights the recommended
  button each decision (classic 6-deck S17 table; reasonable Spanish 21 adaptation,
  including surrender vs ace) and always advises declining insurance. Computed
  server-side (`ClientView.hint`), guaranteed to be a legal action.

### Notes
- 94 tests (MTD payouts, strategy tables, PT minimum schedule).

## [0.4.1] — 2026-07-03

### Added
- **Upgrade CTA on the static demo** — dismissible banner + permanent footer link pointing
  players at the full club (play.minus-one-labs.com): accounts, cross-device chips,
  Spanish 21, bot players, card counter.
- Full server app deployed: **play.minus-one-labs.com** (server2, Docker + Traefik,
  SQLite volume). Dockerfile fixes from the first real deploy: exclude `static/` from
  the Next typecheck/build context, ship the full `@prisma` scope, `apk add openssl`.

## [0.4.0] — 2026-07-03

### Added
- **Spanish 21 variant** — selectable at the bet screen: 48-card decks (no 10s), player 21
  and blackjack always win (even vs dealer 21/BJ), late surrender (half bet back), and
  bonus 21 payouts (5-card 3:2, 6-card 2:1, 7+ card 3:1; 6-7-8 / 7-7-7 mixed 3:2,
  suited 2:1, spades 3:1 — void after doubling). Table arc text reflects the variant.
- **Simulated players ("multiplayer")** — seat up to 3 bots (Vinny, Ruth, Doc) who are
  dealt real cards from the shoe, play deterministic basic strategy after you, and settle
  against the dealer for display. They never touch your chips — but their cards count.
- **Shuffle simulation** — a riffle overlay + synthesized shuffle sound plays whenever a
  fresh shoe is built (start of play, penetration reshuffle, variant switch).
- **Hi-Lo card counter** — eye toggle in the HUD shows running count, true count, and
  decks remaining, updated on every visible card (bots included; hole card at reveal).
  Count carries across rounds with the shoe. Great for counting practice.
- **Custom domain** — the static build is served at blackjack.minus-one-labs.com.

### Notes
- The static GitHub Pages build intentionally stays classic-only (shared engine, old UI).
- Shoes carried over from v0.3.0 rounds start their count at 0 (one-shoe inaccuracy).

## [0.3.0] — 2026-07-03

### Added
- **Static GitHub Pages build** (`static/`) — a Vite + React client-only version of the game
  that imports the exact same `engine.ts` and `sound.ts` (single source of truth). Chips,
  daily bonus, and the active round live in localStorage (mid-hand refresh still resumes);
  no accounts/leaderboard in this build. Deployed automatically by
  `.github/workflows/pages.yml` on every push to `main`. Reset-bankroll control in the footer.

### Notes
- The full server app is unchanged and remains the primary target (accounts, anti-cheat,
  shared leaderboard); the static build is the free public playground.

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
