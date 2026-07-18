# Changelog

All notable changes to Blackjack Club are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/); the `VERSION` file is the source of truth.

---

## [0.31.0] — 2026-07-17

### Added
- **♠ Spades Jokers variant** — 🃏 Big Joker and Little Joker swap in for
  2♣/2♦, keeping the deck at 52 and every hand at 13. Both are permanent
  trump, ranked above everything (Big Joker=21 > Little Joker=20 > A♠=14,
  above promoted deuces too if Deuces High is also on). New top-bar toggle
  alongside Deuces High; changing it starts a new game, same as Deuces
  High. Bot AI is joker-aware: correctly values a joker as a guaranteed
  trick when bidding, and the existing Nil-disqualification check already
  caught jokers for free (their rank is high enough to trip the same "any
  spade Q or higher" guard). `/rules/spades` documents the new variant.
- 10 new vitest tests for the joker card model — Spades had zero test
  coverage before this (focused new coverage, not a retroactive full
  suite).

### Fixed
- **Bid clarity** — each seat's bid is now its own prominent pill (gold,
  bold, color-coded for Nil/Blind Nil/busted-Nil/contract-made), not a
  small muted text fragment sharing a line with the trick count.
- **West/East bid pills were invisible** — a pre-existing z-index gap let
  the opponent card-back fans (`.oppcards--w`/`--e`) paint over the seat
  badges for two of the four seats. Fixed with an explicit `z-index` on
  the seat containers.
- ⚠️ Noted but NOT fixed (pre-existing, out of scope): `/spades` has the
  same latent SSR/client hydration mismatch already documented for
  `/wildcard` — the initial deal's random seed differs between server and
  client render. React recovers automatically; cosmetic only.

---

## [0.30.0] — 2026-07-17

### Added
- **🔑 Forgot password** — self-service reset flow, prompted by an admin
  console question ("can admin check a user's email") that surfaced there
  was no reset path at all, only a manual SSH+DB workaround.
  `/forgot-password` takes an email, always returns the same generic
  message regardless of whether it matched an account (no enumeration),
  and — when a match exists and isn't banned — mails a reset link via the
  existing Resend infra (`lib/email.ts`, now factored around a shared
  `sendEmail()` core so invite and reset emails share one Resend/SMTP
  transport instead of duplicating it). `/reset-password?token=...` sets a
  new password (same complexity rules and strength meter as registration).
  In dev, with no Resend key configured, the raw link is logged
  server-side instead of mailed — that branch never fires in prod.
- **`PasswordResetToken`** table: the raw token rides the email link and is
  never stored — only its sha256 digest (`lib/reset-token.ts`) — so a DB
  leak alone can't be used to reset accounts. Single-use (`usedAt`) and
  expires in 1 hour.
- Reset requests are rate-limited per IP (5/hour, `resetRequestLimiter`)
  reusing the same `SlidingWindowLimiter` registration already uses.
- "Forgot password?" link added next to the password field on `/login`.
- 233 tests (8 new for token generation/hashing/expiry). Verified end to
  end in a live browser pass: request → dev-log link → reset → new
  password signs in successfully → reusing the same (now-consumed) token
  is correctly rejected without touching the account again.

---

## [0.29.0] — 2026-07-17

### Added
- **🎟️ Match-play vouchers** — a "welcome back" mechanic from a `/grill-me`
  design session. Return to the table after 6+ hours away (measured from
  your last settled round, no new presence field needed) and you're handed
  a voucher: the next main-game round that actually wins (side bets and
  jackpots untouched) gets doubled, up to a +10,000 bonus. A loss or push
  doesn't burn it — it just keeps waiting for a real win or lets the
  2-hour window expire. Fully automatic, no toggle. Capped at one grant
  per Vegas day so it can't be farmed by repeated logout/login. Stacks
  freely with Happy Hour's 2:1 naturals boost — the bonus cap already
  bounds the combined risk.
- No cron: `/api/voucher` lazily grants via a CAS `updateMany` (same
  pattern as Hot Seat / the property bonus / VIP tiers) — race-safe,
  verified with 8 concurrent polls landing exactly one grant. Consumption
  happens inline inside the existing bet/action settle transactions, so
  the doubled payout lands in the same instant as the win itself.
- `VoucherBadge` in `TopBar`, fleet-wide, with a live per-second countdown
  — visible on every page, not just `/play`, so the urgency doesn't
  disappear when browsing the leaderboard.
- `lib/voucher.ts` pure engine (13 new vitest tests).
- 225 tests. Verified: real HTTP grant (exact chip-delta math on the
  doubled win), per-round confirmation that losses/pushes don't consume it
  while the next actual win does, 8-way concurrency race, and a live
  Chrome pass showing the badge render and its countdown ticking down in
  real time.

---

## [0.28.0] — 2026-07-17

### Added
- **⭐ VIP tiers** — Member → Silver (100 rounds) → Gold (500) → Platinum
  (2,000) → Diamond (5,000) → Seven Stars (15,000), based on lifetime
  settled rounds played (table time, not luck). Each tier boosts the flat
  daily bonus (+5% to +50%, stacking with the existing login-streak boost
  and Midnight Madness) and pays a one-time tier-up bonus (500 to 50,000)
  the instant a player crosses a threshold.
- No cron: `lib/vip-io.ts` lazily checks lifetime rounds against
  `User.vipTier` on every `/api/vip` poll and claims the tier-up via a CAS
  `updateMany` (same pattern as Hot Seat / the property bonus) — race-safe,
  verified with 8 concurrent polls landing exactly one award.
- `VipStatusBar` on `/play` above the felt shows the current tier badge and
  progress to the next one; toasts + a coin sound the moment a tier-up
  lands.
- `lib/vip.ts` pure tier catalog (6 new vitest tests).
- 212 tests. Verified: real HTTP tier-up against the dev server (exact
  chip delta), idempotent re-poll (no double-pay), VIP-boosted daily bonus
  matched the expected math exactly (2,500 × 1.05 = 2,625 at Silver),
  8-way concurrency race, and a live Chrome pass showing the tier-up toast
  and the persistent status pill with correct round-count progress.

---

## [0.27.0] — 2026-07-17

### Added
- **🎰 Vegas property daily bonus** — pick one of six Vegas-style properties
  once per Vegas day for a surprise cash payout, alongside (not replacing)
  the existing flat daily bonus: **Circus Circus** (safe & flat 750-950),
  **MGM Grand** (standard 500-1,300), **Bellagio** (500-1,100, 5% chance of
  a 2,000 Fountain Show), **Caesars Palace** (wide spread 100-1,700),
  **Wynn** (mostly 300-900, 5% shot at a 5,000 Penthouse jackpot), **The
  Sphere** (250-1,450, 8% chance of an Encore double-up). Ranges are tuned
  so every property lands near the same ~850-950 expected value — the pick
  is a risk-shape choice, not a strictly-better option.
- `User.lastPropertyPick` gates one claim per Vegas day; the claim itself
  is CAS-guarded (`updateMany` on the known prior value) against a
  double-tap racing two requests.
- `PropertyBonusBar` mounted on `/play` above the felt (not inside
  `GameTable` — no WIP dance needed), card-pick UI with a reveal panel on
  claim.
- `lib/property-bonus.ts` pure engine (catalog + weighted roll, 8 new
  vitest tests).
- 203 tests. Verified: real HTTP login + claim against the dev server
  (exact chip delta matched the granted amount), day-gating flips
  correctly after claim, double-claim same day correctly 429s, unknown
  property 400s, 8-way concurrent claim race confirmed exactly one win.
  Playwright-style manual pass in Chrome: card grid renders, pick →
  reveal → toast, "claimed today" persists across reload with the real
  balance reflected.

---

## [0.26.0] — 2026-07-17

### Added
- **🔥 Hot Seat drops** — a random surprise bonus lands on one currently-active
  player every 4–12 minutes: 300–900 chips normally, a rare (5%) 2,000–3,000
  "blaze" jackpot. No cron job — a global singleton row (`HotSeatDrop`) holds
  a `nextDropAt` clock, and whichever player's poll lands after it elapses
  claims the draw via a CAS `updateMany` (same optimistic-concurrency pattern
  as the shared table's turn enforcement); losers of the race no-op. The
  active pool is anyone with an open round or a round settled in the last 3
  minutes, fleet-wide (not scoped to `/play`).
- **`HotSeatWatcher`** mounted in `TopBar` (any authenticated page, not just
  the table) polls `/api/hotseat` every 8s so the clock keeps advancing and
  every client hears about a drop. Winner gets a celebratory toast + coin
  sound; everyone else gets a social-proof nudge ("X just caught the Hot
  Seat!").
- `lib/hotseat.ts` pure engine (interval/amount/winner-index rolls, 6 new
  vitest tests) + `lib/hotseat-io.ts` for the trigger/broadcast IO, mirroring
  the `champions.ts` lazy-idempotent-award pattern.
- 195 tests. Verified: real HTTP login + poll against the dev server (exact
  chip delta matched the awarded amount), 8-way concurrent race against the
  same forced-due clock confirmed exactly one award landed.

---

## [0.25.0] — 2026-07-17

### Added
- **🏋️ Counting Gym (Phase 1)** at `/gym` — speed-flash Hi-Lo drills. Cards
  flash from a fresh 6-deck shoe at five difficulty levels (Rookie 12 @
  1.4s → Wizard 52 @ 0.35s); call the running count at the end and the
  server grades it (it issued the cards and holds the truth). First perfect
  drill each Vegas day pays **+250 chips**; lifetime drills/accuracy/best
  level shown in the gym.
- Two new trophies: **Fresh Legs** (first drill) and **Eagle Eyes** (perfect
  at Pro or Wizard) — the case is now 23.
- **Hit the Gym** joins the daily-quest rotation. Gym drills deliberately
  don't count as table rounds — they can't advance Grinder's Shift or break
  a live Back to Back run.
- Gym link in the top bar; 5 new tests (**189 total**).
- Phases 2–5 (deck countdown, true-count school, public board, count-along
  quizzes at the live table) tracked on GitHub issue #3.

---

## [0.24.0] — 2026-07-17

### Added
- **🔥 Fire-streak chips** (Kendall's call) — 5 wins in a row sets the chip
  stack ablaze: flickering flame, pulsing amber glow on the count, and a
  live streak badge. Stays lit until a loss puts it out. The streak is the
  server-tracked `winStreak` (pushes carry, losses reset).
- **Public player pages** — click any name on the leaderboards →
  `/player/[id]`: stats, best streak, champion titles, unlocked trophies,
  and (when you've shared a duo table) **your head-to-head record** against
  them. Members-only; own name routes to your profile.
- **Rivalries** — duo-table head-to-head records (W–L over shared rounds)
  on your profile, built by pairing the per-player round rows each shared
  settle writes. Winning a shared round = the better total (main + side).
- **Hand replay** — every row in Recent Hands expands into the full round:
  dealer and player cards, totals, outcomes, side-bet results, bust bet.
  Parsed server-side from the stored round state — the shoe never ships.
  Duo rounds are badged 👥.
- **Bankroll sparkline** — cumulative net over your last 100 rounds, gold
  when you're up, red when the shoe's been cruel.
- **Roadmap now tracked as GitHub issues** — 14 issues labeled
  `phase:big-build` / `phase:fresh-idea` / `phase:quick-win`.

---

## [0.23.0] — 2026-07-17

### Added
- **Daily quests** — three per Vegas day: Grinder's Shift (settle 5 rounds)
  is always on the board, plus two rotating picks from an 8-quest catalog
  (win 3, win 2 in a row, blackjack, side-bet hit, doubled win, duo round,
  bust-bet call). Rewards (500–1,000 chips) pay the instant a quest
  completes; progress advances on every settle — solo AND shared tables,
  scoped per seat. Quest pills with live progress meters sit above the felt
  (`QuestsBar`, 6s poll, completion toast + coins).
- **Login streaks** — claiming the daily bonus on consecutive Vegas days
  grows a streak that boosts the bonus **+250/day up to +1,750** (Midnight
  Madness doubles the boosted total). Streak flame shown in the quest bar.
- **Board champions** — when a daily/weekly leaderboard window closes, the
  top qualified player is crowned automatically: **+2,500 daily /
  +10,000 weekly**, the new 👑 Board Champion trophy (catalog is now 21),
  and a champions strip on the leaderboard. No cron: the first board view
  after the window closes triggers the crowning (idempotent, race-safe).
- New `QuestProgress`/`BoardAward` tables, `User.loginStreak`; Vegas
  calendar-key helpers in `lib/leaderboard.ts`; 8 new tests (**184 total**).

---

## [0.22.0] — 2026-07-16

### Added
- **Settle receipt in the result banner** — every wager that rode the round,
  settled line by line: main game, each side bet (with the winning tier's
  name), the **Dealer Bust bet** (the double confirmation — it was
  toast-only before), the progressive jackpot, and a bold round total. The
  banner's verdict (YOU WIN / HOUSE WINS) now reflects the WHOLE round, not
  just the main game.
- **Rolling win meter** — wins count up from zero with a filling gold bar.
  Big wins (3× your stake back, or any jackpot) get the full celebration:
  flash animation, ✨ BIG WIN banner, and layered coin-cascade sounds on top
  of the fanfare. Losses keep their sound and get no meter.
- **Card-counting panel v3** — a real needle gauge for the true count
  (cold→hot color arc, sprung needle animation), a shoe-depletion donut
  showing decks remaining, and the read spelled out at all times
  (🔥 HOT — bet bigger / ❄️ COLD — table min / NEUTRAL). The whole panel
  pulses green when the shoe runs hot.

---

## [0.21.1] — 2026-07-16

### Added
- **Invite emails are LIVE via Resend** — `lib/email.ts` now prefers Resend
  (`RESEND_API_KEY` + `EMAIL_FROM`, plain fetch, no SDK) and sends as
  **Blackjack Club &lt;reply@minus-one-labs.com&gt;** (domain verified in the
  Minus One Labs Resend team). Gmail SMTP remains as fallback; with neither
  configured invites stay in-app only.

---

## [0.21.0] — 2026-07-16

### Added
- **Duo Table — the Club's first real multiplayer.** Host + one invited
  friend at the SAME table: shared shoe, own chips, own bets, full side bets
  (Perfect Pairs / 21+3 / Lucky Ladies incl. the progressive — a shared
  table can win the pot). Built from the 7-decision design grill:
  - **Invites**: members-only, in-app bell + email (Gmail SMTP, env-gated —
    in-app-only until `SMTP_USER`/`SMTP_PASS` are set). The seat is held
    **5 minutes**; inviting someone else supersedes the hold; the host can
    cancel it.
  - **Turn clock**: 30 seconds per decision with an on-seat countdown —
    expiry auto-stands, enforced lazily by the next poll (no cron).
  - **Host controls everything**: kick the guest or end the table (between
    rounds); the guest can leave; either way the table survives for the host.
  - **Sync**: 1.5s polling — turn-based blackjack needs nothing heavier.
  - Not at shared tables (documented in the launcher): insurance/even money
    (auto-declined) and the Dealer Bust bet (solo-only).
- **Engine: per-seat wagers + hand ownership** — `seatBets`/`seatSideBets`
  options and an `owner` on every hand (splits inherit it), plus
  `netResultForOwner`/`sideNetForOwner`. The deal debits BOTH players in one
  transaction; settle pays each seat exactly its own hands.
- **Every stat still counts**: settle writes one Round row per player
  (`Round.tableId` marks them; solo shoe carry skips shared shoes), so
  leaderboards, win streaks, and achievements all track duo play — scoped
  per owner, so the guest's blackjack can't unlock the host's trophy.
- New `Table`/`Invite` models; `/table` launcher; invite bell in the TopBar;
  6 new engine tests (**176 total**, engine 122).
- E2E: a full two-session round (25 assertions) — invite → supersede → join,
  turn locks both directions, exact per-player chip deltas with mixed side
  bets, the 30s clock settling an abandoned round, kick lockout — plus a
  dual-browser Playwright pass on the live UI.

---

## [0.20.1] — 2026-07-16

### Fixed
- **Turnstile site key now reaches the production build** — `.env` is
  dockerignored, so the `NEXT_PUBLIC_*` inline never happened; the compose
  file now passes `NEXT_PUBLIC_TURNSTILE_SITE_KEY` as a build arg
  (interpolated from the host `.env`). Secret key stays runtime-only.
  Turnstile is ACTIVE on /register as of this deploy.

---

## [0.20.0] — 2026-07-16

### Added
- **Pit Boss console at `/admin`** (admin role only; 404s for everyone else,
  invisible in the UI) — first slice of `docs/ADMIN-CONSOLE.md`:
  - **Players** — searchable list with chips, rounds, trophies, streak, role;
    per-player **chip adjustments**, **ban/unban**, **trophy grant/revoke** —
    every action requires a typed reason
  - **Signals** — total players, joined-24h, never-played, banned counts
    (burst thresholds highlight red)
  - **Bulk purge** — delete never-played `user`-role accounts older than N
    days (re-checks conditions inside the delete)
  - **Audit log at `/admin/audit`** — every console action recorded
    (actor, target, before/after, reason)
  - Admin promotion is deliberately shell-only: `scripts/promote-admin.js`
    (`docker exec blackjack node scripts/promote-admin.js <email>`)
  - Chip adjustments touch `User.chips` only, never Round rows — the
    daily/weekly boards can't read a top-up as winnings
- **Registration defense** — four layers on `/register`:
  - honeypot field (bots that autofill it get a fake success)
  - per-IP sliding-window rate limit (3 accounts/hour, runs before content
    checks so junk attempts burn the budget)
  - disposable-email domain blocklist
  - **Cloudflare Turnstile** — active the moment `TURNSTILE_SECRET_KEY` /
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set (fails closed when enabled);
    ships dark until the CF widget key is created
- **Ban enforcement** — banned accounts can't log in, and existing JWT
  sessions are hollowed out on their next request (the jwt callback already
  re-checked the DB per request; banned now invalidates like deleted).
- 8 new tests (limiter window math, disposable matching, Turnstile
  fail-closed/inert modes) — **170 total**.

---

## [0.19.0] — 2026-07-15

### Added
- **Achievements** — 20 trophies awarded server-side at settle time, from
  "Welcome to the Club" (first round) to "Chip Millionaire" (1M stack),
  "The Queen's Crown" (Lucky Ladies jackpot), "Nerves of Steel" (all-in win),
  "Bust Prophet" (cash a Dealer Bust bet), "Golden Hour" (2:1 blackjack
  during Happy Hour) and trainer trophies ("Book Smart" 25-streak,
  "By the Book" 90%+ over 100 blind decisions). Catalog + pure earn-checks
  in `src/lib/achievements.ts`; the DB stores only `(userId, slug,
  unlockedAt)`. Unlocks ride along on the bet/action responses and land as
  staggered golden toasts with a coin fanfare.
- **Trophy Case on the profile** — full 20-trophy grid (locked ones dimmed
  with how-to-earn hints), plus new **Win streak** (current · best) and
  **Trophies** stat cards.
- **Win-streak tracking** — `User.winStreak` / `bestWinStreak` maintained in
  the settle transaction: wins extend, losses reset, pushes carry. Powers
  the "Heating Up" (5) and "On Fire" (10) trophies.
- **Trophy chips on every leaderboard row** — 🏆 count next to each name.
- **Wild Card Club has sound** — the club's synthesized Web Audio kit now
  voices `/wildcard`: deal riffle, card swishes for every play (bots too),
  a color-call chime on wilds, a snap on skip/reverse/draw-2, penalty draws,
  hand-win fanfare and a game-over warble. One central state-diff effect in
  `useWildcard` catches every transition; a 🔊 topbar toggle shares the
  club-wide mute switch.
- `docs/ADMIN-CONSOLE.md` — full design for a `/admin` pit-boss console
  (players, chip adjustments with audit log, round inspector, house
  dashboard, jackpot override). Design only, by request — no code yet.
- 13 new tests (achievement earn-checks, trainer thresholds, streak
  transitions) — **162 total**.

### Fixed
- `/wildcard` hydration mismatch — the opening deal is random, so SSR and
  client rendered different cards and React regenerated the whole tree on
  every load. The table now renders after mount only.

---

## [0.18.0] — 2026-07-15

### Added
- **Leaderboard, rebuilt as four boards** (from the design grill):
  - **High Rollers** — all-time top stacks (unchanged)
  - **Today** — net winnings since midnight *Vegas time*, side bets and
    jackpots included, with a "biggest single win" callout
  - **This Week** — same, Monday-anchored on the Vegas clock
  - **Strategy Masters** — best blind-decision accuracy against the book
    (accuracy % · decision volume · best streak)
  Minimum **10 settled rounds** in the window to rank on the daily/weekly
  boards (negative leaders shown — honesty over vanity); minimum
  **100 graded decisions** for Strategy Masters. Your own row appears below
  the top 10 when you're outside it; progress callouts show how close you
  are to qualifying.
- **True net tracking** — new `Round.sideNet` column records each round's
  side-bet net (PP/21+3/Lucky Ladies stakes vs payouts, bust bet, jackpot),
  because `netResult` has been main-game-only since v0.8.0 and a daily board
  built on it would show a jackpot winner as flat. Backfilled for history
  from each round's persisted `stateJson`.
- **Server-graded trainer decisions** — the action route now grades every
  attested-blind decision against its own book (`TrainerStat` table:
  right/wrong/streak/best). The client only claims the guide was hidden;
  accuracy itself can't be fabricated. The local scorecard pill stays as the
  live in-session display; the server record feeds Strategy Masters.
- New `src/lib/leaderboard.ts` — Vegas-clock day/week window math
  (DST-safe), qualification constants; 8 new tests (window boundaries
  incl. PST/PDT and the Sunday→Monday reach-back, sideNet accounting) —
  **149 total**.
- E2E verified: 12 live rounds produced exactly 15 server-banked blind
  decisions, the Today board showed the qualified row, and all four boards
  render with correct callouts.

## [0.17.0] — 2026-07-15

### Added
- **House Rules hub (`/rules`)** — one public page covering every game in the
  Club, with a card per table (quick facts + link) and full rules pages for
  the three games that never had any:
  - **`/rules/spades`** — partnership seating (you + North vs West + East),
    bidding incl. Nil ±100 / Blind Nil ±200, follow-suit and
    breaking-spades rules, the full scoring table (contract ×10, bags,
    10-bag −100 rollover), and the Deuces High variant (2♠ > 2♥ > 2♣ > 2♦
    above the A♠).
  - **`/rules/roulette`** — both wheels (European 37 / American 38 pockets
    with house-edge notes), every inside bet (straight 35:1 → six line 5:1,
    European first-four 8:1, American five-number 6:1) and outside bet, the
    zeros-take-everything explanation, and the separate 1,000-chip table
    bankroll.
  - **`/rules/wildcard`** — 108-card deck composition, matching rules,
    action-card effects, the "last card!" 2-card penalty, and scoring
    (face value / 20 / 50, first to 500).
  All content written from the engines themselves, not generic rulebooks.
- Shared `rules-ui` components (Section/PayTable/RulesHeader) — extracted
  from How to Play so every rules page shares one look; How to Play now
  uses them too and is retitled "How to Play — Blackjack" with a hub link.
- TopBar "Rules" now goes to the hub (logged in and out).
- Playwright-verified: all five pages render logged-out with the right
  content, hub cards navigate, and the TopBar link lands on the hub.

## [0.16.0] — 2026-07-15

### Added
- **Dealer Bust bet** — while the dealer shows a 5 or 6 (their weakest
  upcards), a fire bar appears mid-round: even money that the dealer
  **busts**, for **any amount you can cover** (no side-bet cap; up to the
  table max). One per round, placed any time before the dealer plays; while
  it rides the dealer always plays out their hand, even when every player
  hand busted. Resolved at settle outside the main staked/payout accounting
  (`RoundState.bustBet`/`bustPayout`, `placeBustBet()`/`canPlaceBustBet()`,
  new `/api/game/bust-bet` route). Ten-rich shoes make it a counter's toy —
  intentionally.
- **Floor promotions on the Vegas clock** (`src/lib/promotions.ts`, single
  source for the engine, banner, sign, and rules page):
  - **Happy Hour (5pm–7pm PT): blackjack pays 2:1** — locked in at the deal
    (a round dealt 6:59pm still pays 2:1), badge reads "Blackjack 2:1!".
  - **Midnight Madness (midnight–2am PT): daily bonus pays double** (5,000).
- **Promo banner, always shouting** — an animated strip above the table:
  the live promo with a countdown while one runs, otherwise a teaser for
  the next one ("starts in 3h 56m"). The table sign footer lists the bust
  bet and the full promo schedule.
- 14 new tests (bust-bet legality/payout/dealer-plays-out rules, happy-hour
  2:1 math, promo clock boundaries incl. midnight wrap) — 141 total.
- E2E verified: bust bet debit/payout math exact over multiple rounds
  including a real dealer-bust win at 2×, 409s on wrong upcard and double
  placement, 150-chip wager proving the old side-bet cap doesn't apply;
  Playwright confirmed the promo banner, fire bar, riding pill, and result
  toast in the browser.

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
