# Changelog

All notable changes to Blackjack Club are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); the `VERSION` file is the source of truth.

---

## [0.15.1] — 2026-07-15

### Changed
- **Blind-only trainer scoring** (from the design grill): the scorecard now
  counts ONLY decisions made with the strategy guide hidden (master
  lightbulb off, or that hand's bulb off) — following the glowing button no
  longer inflates accuracy. Mistakes still get coached either way. The old
  scorecard reset once with this change (its number mixed assisted plays and
  meant something different); the localStorage key moved to
  `bj-trainer-stats-v2`.
- How to Play now spells out blind scoring, notes that side bets are never
  graded, and labels the Spanish 21 guide as a close simplification of the
  published chart.
- Decisions locked for the roadmap: "Pro book" (Illustrious 18 count
  deviations) as an opt-in toggle, server-side "Strategy Masters"
  leaderboard (min 100 blind decisions) with the leaderboard-categories
  work, full-fidelity Spanish 21 chart backlogged.

## [0.15.0] — 2026-07-15

### Added
- **Lucky Ladies side bet with a PROGRESSIVE JACKPOT** — first two cards
  totaling 20: any 20 4:1, suited 20 9:1, matched 20 (identical cards) 19:1,
  Queen of Hearts pair 125:1, all paid instantly at the deal. Every Lucky
  Ladies stake feeds a **site-wide progressive pot** (new `Jackpot` table,
  seeded at 25,000, auto-created by boot-time `prisma db push`); a Q♥ pair
  while the dealer has blackjack wins the ENTIRE pot, which then reseeds.
  One pot, one winner: with multiple qualifying seats the first takes it.
  The jackpot tier resolves at settle (dealer blackjack isn't public during
  an insurance phase), paid by the API in the same transaction pattern.
- **Casino table sign, on screen at all times** — a Galaxy-Gaming-style
  neon-rimmed vertical sign beside the felt (compact expandable jackpot
  banner on mobile) showing the live progressive pot, the full Lucky
  Ladies / 21+3 / Perfect Pairs paytables (rendered from `rulesFor()` so
  the sign can't drift), the live Vegas-clock minimum, and the house rules
  line. Crown toggle in the HUD hides it if you want the felt to yourself.
- **Per-hand strategy guide** — the on-screen book (dealer stands on all
  17s) can now be flipped on/off for each hand independently: a small bulb
  on every hand box, remembered per seat. The master lightbulb still rules
  them all.
- **Card counter, visualized** — the count pill grew into a proper panel:
  color-coded running/true count (green hot, red cold), a hot–cold meter
  positioning the true count on a −5…+5 gradient, a shoe-depletion bar,
  and plain-English bet advice in the tooltip ("the book says bet bigger").
- 8 new engine tests (full Lucky Ladies paytable incl. soft 20, jackpot
  flag with/without dealer BJ, first-hand-only rule for two Q♥ pairs,
  triple side-bet stacking) — 127 total.
- E2E verified: pot fed by exactly the stake every deal, a live "any 20"
  paid +20 on the spot with exact chip math incl. the pot; Playwright
  confirmed the sign (desktop + mobile banner), bet row, badge, count
  panel, and the per-hand bulb hiding/restoring the guide.

## [0.14.0] — 2026-07-15

### Added
- **21+3 side bet** — your first two cards plus the dealer's upcard as a
  three-card poker hand, placed alongside Perfect Pairs before the deal
  ($1–$100 per seat). Standard Vegas paytable: flush 5:1, straight 10:1,
  three of a kind 30:1, straight flush 40:1, suited trips 100:1. Aces play
  high or low in straights (A-2-3 and Q-K-A both count; no wrap-around).
  Paid **instantly at the deal** via the same `SideBetResult` / on-the-spot
  transaction pattern as Perfect Pairs — main-game accounting and the result
  banner exclude it. Result badge on every hand, new bet row in the picker,
  paytable added to How to Play (rendered from `rulesFor()` so docs can't
  drift).
- **Strategy trainer (learning mode)** — a graduation-cap toggle in the HUD
  grades every decision you make against basic strategy the moment you make
  it. Mistakes get coached with a toast naming the correct play *and why*;
  correct-play streaks earn milestone celebrations (5/10/25/50/100…). A
  persistent scorecard pill tracks correct/mistakes, accuracy %, current and
  best streak (localStorage, with a reset button). Runs independently of the
  hint lightbulb — hints off + trainer on is the "real test" mode.
- **Hint explanations** — the lightbulb hint now says *why*: every
  recommendation carries a one-line plain-English reason (new
  `explainAction()` in `strategy.ts`, `hintReason` on `ClientView`), shown
  under the hint line and inside coach toasts. Aces/eights splits, stiff
  hands vs weak dealers, soft doubles, insurance math, and even-money value
  all get their own tailored story.
- 17 new tests (11 engine: full 21+3 paytable, ace-high/low straights,
  no wrap-around, stacking with Perfect Pairs, multi-seat, validation;
  6 strategy: explanation content + `withHint` reason plumbing) — 119 total.
- E2E verified against the dev server: a live 21+3 straight paid +50 on the
  spot with exact chip math, and Playwright confirmed the bet row, badge,
  trainer scorecard, hint reasons, and coach toast in the browser.

## [0.13.0] — 2026-07-15

### Added
- **Play up to 3 hands at once** (was 2) — the seat picker in the bet screen
  now offers 1/2/3 Hands. The engine already generalized over seat count
  (`Array.from({ length: seats }, ...)`), so this was mostly a UI change:
  the seat-picker buttons, "Bet × N" label, and All In tooltip now scale
  with `seats` instead of assuming exactly 2. Verified the felt layout
  (already a flex-wrap grid, not hardcoded to 2 slots) holds up cleanly on
  both desktop and mobile with 3 hands live at once.
- Re-verified the shoe-depth safety margin for the extra seat: the split
  budget (`state.splits`) is round-wide, not per-seat, so adding a 3rd seat
  only adds one more base hand's worth of card consumption (~5-6 cards),
  not a proportional increase — worst case at the reshuffle floor stays
  comfortably inside the existing 25% margin. Comment in `engine.ts`
  corrected to reflect this (previously implied splits scaled per seat).
- 3 new engine tests (three-seat deal, independent settlement, and a split
  on one seat while two others play normally) — 102 total, plus confirmed
  existing hint/strategy logic needed no changes (already per-hand).
- Static demo (`blackjack.minus-one-labs.com`) intentionally NOT updated —
  by existing convention (Spanish 21/bots/counter are "main app only, static
  stays classic by choice"), new gameplay scope stays on the full app.

## [0.12.0] — 2026-07-11

### Added
- **Wild Card joins the Club at `/wildcard`** — the classic 108-card
  color-shedding game vs three heuristic bots: skips, reverses, draw-twos,
  wilds, a "Last card!" declaration (2-card penalty if you forget), and scoring
  to 500 with per-hand breakdowns. Original name/art (no trademarked branding).
  Advertised on the lobby. Engine ported from the standalone Wild Card Club
  (22 vitest tests). No LLM.

---

## [0.11.0] — 2026-07-11

### Added
- **Roulette** joins the Club at `/roulette` — play-money European single-zero
  or American double-zero, a full betting table (all inside bets via line
  hotspots plus every outside bet), an animated canvas wheel, chips with
  undo/clear/rebet, and a browser-saved bankroll. No LLM. Advertised on the
  lobby. Engine ported from the standalone Roulette Club (20 vitest tests).

---

## [0.10.0] — 2026-07-10

### Added
- **Spades "Deuces high" variant** (toggle in the Spades top bar). All four 2s
  become the highest trumps, ranked **2♠ ▸ 2♥ ▸ 2♣ ▸ 2♦** above the A♠. The
  three off-suit deuces follow as spades (a 2♥ no longer follows a heart lead),
  show a ♠ badge + gold ring, and sort to the front of the hand. Bots play
  trump-aware. Toggling starts a new game.

---

## [0.9.1] — 2026-07-10

### Fixed
- **Spades bid panel covered your hand.** It's now draggable by its header — pull
  it aside to read your cards while choosing a bid.
- **Spades version now shows the real app version** at the top of the page
  (was a stale hardcoded number), sourced from the build so it can't drift.

---

## [0.9.0] — 2026-07-10

### Added
- **Spades — a second game at the Club.** Blackjack Club is now a games hub: a new
  `/spades` route hosts full partnership Spades (You + North vs West + East, first to
  500), and the lobby advertises it with a "New — Spades" card.
  - Nil (+100) and Blind Nil (+200) bids; scoring with bags (−100 at 10) and sets.
  - Three heuristic bots (no LLM, no API cost) — they cover their partner, protect a
    nil, set the opponents, and don't waste trumps.
  - Framework-free engine ported from the standalone build; all Spades styles are
    scoped under `.spades-app` so they can't touch Blackjack's Tailwind.
  - Self-contained and client-only — no accounts or DB needed to play a hand.

---

## [0.8.0] — 2026-07-03

### Added
- **Instant side-bet payouts** — Perfect Pairs winnings are credited the moment the
  cards land (same transaction as the deal), with a color-cycling glow animation on the
  badge (💎 gold→emerald→pink) and a sparkling win sound. The hand plays on as normal.
  Main-game accounting (result banner, round netResult) now excludes the side bet.
- **Even money** — with blackjack against a dealer ace, choose a guaranteed 1:1 on the
  spot or play it out for 3:2 (new `even-money-yes/no` actions, "Even Money ✓" badge;
  hint advises playing it out). Falls back to regular insurance when only one of two
  seats holds a natural.
- **Chips on the felt** — each hand's bet renders as a mini chip stack beside the cards
  (desktop screens only; hidden on small screens for space).

### Notes
- 99 tests. Player blackjack already settled immediately when no dealer peek is pending.

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
