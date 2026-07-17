# ♠ Blackjack Club

[![Version](https://img.shields.io/badge/version-0.30.0-blue)](./VERSION)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-233%20passing-brightgreen)](./src/lib/blackjack/engine.test.ts)

A play-money blackjack site in the spirit of Zynga Poker — real casino rules, persistent
chip balances, daily free chips, and a dim, gold-on-felt "midnight table" aesthetic.
**No real money, no purchases, no payouts — just cards.**

**Play it:** full club at [play.minus-one-labs.com](https://play.minus-one-labs.com) ·
free demo at [blackjack.minus-one-labs.com](https://blackjack.minus-one-labs.com)

## Features

- **Full standard blackjack** — 6-deck shoe (75% penetration reshuffle), blackjack pays 3:2,
  US peek, dealer stands on all 17s, hit/stand/double/split, one re-split, split aces get one
  card, double after split, insurance pays 2:1.
- **Server-authoritative engine** — all game logic runs server-side; the client only renders
  state and sends actions. The dealer's hole card and the shoe are never sent over the wire
  until reveal, and chip balances mutate in the same DB transaction as round state.
- **Accounts & persistent chips** — Auth.js v5 (email/password, optional Google OAuth),
  10,000 starting chips, +2,500 daily bonus, house rescue stake when you bust out.
- **Up to three hands at once** — seat selector deals casino-style and plays hands left to
  right; plus an **All In** button for the brave.
- **Synthesized sound effects** — chip clinks, card swishes, win fanfares, and an
  arcade-death warble on losses; all Web Audio, no asset files, mutable from the HUD.
- **Rounds survive refresh** — active round state is persisted; reload mid-hand and resume.
- **Mobile-friendly** — compact card/chip layout and safe-area handling for iPhone.
- **Lobby leaderboard & profile stats** — high rollers list, hands played, win rate,
  biggest win, recent-hands ledger.

## Stack

Next.js 16 (App Router) · React 19 · Auth.js v5 (JWT sessions, PrismaAdapter) ·
Prisma 5 + SQLite · Tailwind v4 · vitest

## Quick Start

```bash
npm install
cp .env.example .env      # set AUTH_SECRET (openssl rand -base64 32)
npx prisma db push        # creates prisma/dev.db
npm run dev               # http://localhost:7600
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port **7600** |
| `npm test` | Engine test suite (40 tests, vitest) |
| `npm run build` | `prisma generate` + production build (standalone output) |
| `npm start` | Serve the production build |

## Architecture

```
src/lib/blackjack/engine.ts   pure rules engine (no I/O) + engine.test.ts
src/app/api/game/bet          start a round (debits chips, deals)
src/app/api/game/action       hit/stand/double/split/insurance → 409 on illegal moves
src/app/api/game/state        resume/poll current round + chips + bonus availability
src/app/api/bonus             daily +500 / broke rescue
src/auth.ts + auth.config.ts  Auth.js v5 split config (edge-safe middleware)
prisma/schema.prisma          User (chips, lastDailyBonus), Round (stateJson, netResult)
```

The engine is deterministic given a shoe: `startRound()` and `applyAction()` return
`{ state, debit }` so the API layer owns all money movement. `clientView()` is the only
serializer allowed to leave the server.

## Play it free (GitHub Pages)

`static/` contains a client-only Vite build of the same game — identical engine and
sounds, chips saved in your browser (localStorage) instead of an account. It deploys
automatically to GitHub Pages via `.github/workflows/pages.yml` on every push to `main`.

```bash
cd static && npm install && npm run dev   # http://localhost:7601
```

## Deployment (full server app)

Built with `output: "standalone"` and a Dockerfile for the standard Saltbox pattern
(`docker compose up --build -d`). Persist `./prisma` as a volume for the SQLite DB.

## Environment

| Var | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, e.g. `file:./dev.db` |
| `AUTH_SECRET` | Auth.js JWT secret |
| `AUTH_URL` | Canonical URL (`http://localhost:7600` in dev) |
| `GOOGLE_CLIENT_ID/SECRET` | Optional — Google sign-in appears only when set |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) — prioritized ideas for side bets, social features,
tournaments, themes, and retention mechanics.

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.30.0 | 2026-07-17 | **🔑 Forgot password** — self-service email-based reset flow. `/forgot-password` → emailed link (Resend, same infra as Duo invites) → `/reset-password`. Single-use, 1-hour-expiring, sha256-hashed tokens; generic response either way so the flow can't be used to enumerate accounts; rate-limited per IP. |
| 0.29.0 | 2026-07-17 | **🎟️ Match-play vouchers** — return after 6+ hours away and your next main-game win (within 2 hours) is doubled, up to +10,000 bonus. Fully automatic, once per Vegas day, live countdown badge in the top bar. |
| 0.28.0 | 2026-07-17 | **⭐ VIP tiers** — Member → Silver → Gold → Platinum → Diamond → Seven Stars, based on lifetime rounds played. Each tier boosts the flat daily bonus (+5% to +50%) and pays a one-time tier-up bonus (500 to 50,000) the instant you cross a threshold. Status pill above the felt shows progress to the next tier. |
| 0.27.0 | 2026-07-17 | **🎰 Vegas property daily bonus** — pick one of 6 Vegas properties (Circus Circus, MGM Grand, Bellagio, Caesars Palace, Wynn, The Sphere) once per Vegas day for a surprise cash payout, alongside the existing flat daily bonus. Same-ish expected value across all 6, different risk shape per property (safe/flat vs. wide-spread vs. rare-jackpot). CAS-guarded against double-claims. 203 tests. |
| 0.26.0 | 2026-07-17 | **🔥 Hot Seat drops** — a random surprise bonus (300–900, rare 2,000–3,000 blaze) lands on one currently-active player every 4–12 minutes, no cron: whoever's poll lands after the clock elapses claims the draw via a CAS mutex, race-tested with 8 concurrent requests. Winner gets a big toast, everyone else gets social-proof ("X just caught the Hot Seat!"). Fleet-wide watcher polls from any page, not just the table. 195 tests. |
| 0.25.0 | 2026-07-17 | **🏋️ Counting Gym** — speed-flash Hi-Lo drills at 5 difficulty levels from a real 6-deck shoe, server-graded, +250 for the first perfect each day, Fresh Legs & Eagle Eyes trophies, Hit the Gym daily quest. Phases 2–5 tracked on issue #3. 189 tests. |
| 0.24.0 | 2026-07-17 | **🔥 Fire-streak chips** (5 wins in a row ignites the stack until a loss), **public player pages** with head-to-head duo records from leaderboard names, **rivalries** + **hand replays** + **bankroll sparkline** on the profile. Roadmap moved to labeled GitHub issues. |
| 0.23.0 | 2026-07-17 | **Daily quests** (3/day on the Vegas clock, instant chip rewards, live progress pills above the felt), **login streaks** boosting the daily bonus +250/day to +1,750, and **board champions** — daily +2,500 / weekly +10,000 crowned automatically when windows close, with a 👑 Board Champion trophy and champions strip. 184 tests. |
| 0.22.0 | 2026-07-16 | **Settle receipt** in the result banner (main game + every side bet + **Dealer Bust bet** + jackpot, line by line with a round total — the verdict now covers the whole round), a **rolling win meter** with big-win celebrations (losses untouched), and **card-counting v3**: true-count needle gauge, shoe donut, always-visible read, hot-shoe pulse. |
| 0.21.1 | 2026-07-16 | Duo Table invite **emails live via Resend** — sends as `Blackjack Club <reply@minus-one-labs.com>`; Gmail SMTP fallback retained. |
| 0.21.0 | 2026-07-16 | **Duo Table — first real multiplayer.** Invite a member (in-app bell + email, seat held 5 min, invites supersede), share one shoe with own chips/bets/side bets incl. the progressive, 30s turn clock with auto-stand, host kick/end controls, 1.5s polling. Engine grew per-seat wagers + hand ownership; every leaderboard/streak/achievement counts duo play per player. 176 tests. |
| 0.20.1 | 2026-07-16 | Turnstile site key plumbed through the Docker build (build arg from host `.env`) — the human check is now live on `/register`. |
| 0.20.0 | 2026-07-16 | **Pit Boss console** (`/admin`, admin-role only, 404-invisible otherwise) — searchable players with audited chip adjustments / ban–unban / trophy grants, bot signals, bulk purge of never-played accounts, full audit log; promotion is shell-only. **Registration defense**: honeypot, 3-per-IP-hour rate limit, disposable-email blocklist, and Cloudflare Turnstile (activates when keys are set). Bans also kill existing sessions. 170 tests. |
| 0.19.0 | 2026-07-15 | **Achievements** — 20 server-awarded trophies (first hand → Chip Millionaire → the Queen's Crown jackpot), a **Trophy Case** on the profile with win-streak stats, 🏆 counts on every leaderboard row, and unlock toasts with a coin fanfare. **Wild Card Club gets full sound** (every play voiced, shared mute switch) + its hydration flash fixed. Admin console designed (`docs/ADMIN-CONSOLE.md`), not yet built. 162 tests. |
| 0.18.0 | 2026-07-15 | **Four leaderboards** — High Rollers, Today, and This Week (net winnings on the Vegas clock, side bets + jackpots included via the new `sideNet` column, 10-round minimum, biggest-single-win callout), plus **Strategy Masters**: server-graded blind-decision accuracy vs the book, 100 decisions to qualify. 149 tests. |
| 0.17.0 | 2026-07-15 | **House Rules hub at `/rules`** — public rules for every game in the Club: full new pages for Spades (bidding, bags, Deuces High), Roulette (both wheels, every payout), and Wild Card (actions, last-card penalty, scoring), all written from the engines. TopBar Rules now lands on the hub. |
| 0.16.0 | 2026-07-15 | **Dealer Bust bet** (dealer shows 5/6 → even money they bust, ANY amount, dealer plays out while it rides) and **floor promotions on the Vegas clock** — Happy Hour 5–7pm PT pays blackjacks 2:1, Midnight Madness doubles the daily bonus, with an always-on animated promo banner counting down. 141 tests. |
| 0.15.1 | 2026-07-15 | **Blind-only trainer scoring** — the scorecard counts only decisions made with the guide hidden, so accuracy means you know the book (one-time scorecard reset). Side bets never graded; Spanish 21 guide honestly labeled a simplification. |
| 0.15.0 | 2026-07-15 | **Lucky Ladies side bet + site-wide PROGRESSIVE JACKPOT** (Q♥ pair + dealer BJ wins the pot), a **casino table sign on screen at all times** (live jackpot ticker + every paytable, neon-rimmed like the real thing), **per-hand strategy guide toggles**, and a **visual card-counting panel** (hot/cold meter, shoe depletion, bet advice). 127 tests. |
| 0.14.0 | 2026-07-15 | **21+3 side bet** (two cards + upcard as 3-card poker: flush 5:1 → suited trips 100:1, paid instantly at the deal) and a **strategy trainer** — graduation-cap toggle grades every play against basic strategy, coaches mistakes with the correct play *and why*, and keeps an accuracy/streak scorecard. Hints now explain their reasoning too. 119 tests. |
| 0.13.0 | 2026-07-15 | **Play up to 3 hands at once** (was 2) — engine already generalized over seat count, so this was mostly a UI change (seat picker, bet labels). Re-verified shoe-depth safety margin for the extra seat. See [CHANGELOG.md](./CHANGELOG.md) for the full list of releases between here and 0.9.1 (Roulette, Wild Card, side-bet/economy work). |
| 0.9.1 | 2026-07-10 | Spades polish: draggable bid panel (no longer hides your hand) and the on-screen version now reflects the real app build. |
| 0.9.0 | 2026-07-10 | **Spades joins the Club.** New `/spades` route with full partnership Spades (Nil, Blind Nil, bags, to 500) vs heuristic bots — no LLM, no accounts needed. Lobby now advertises it. Blackjack Club is a games hub. |
| 0.8.0 | 2026-07-03 | **Instant side-bet payouts** — Perfect Pairs pays the moment the cards land (same transaction as the deal) with a color-cycling glow + sparkle sound, then the hand plays on. **Even money** offered on blackjack vs a dealer ace (guaranteed 1:1 or play the 3:2). Bets render as mini chip stacks on the felt (desktop). |
| 0.7.0 | 2026-07-03 | **Leaderboard** (top 10 chip stacks with crown/medals, your rank shown even outside the top 10) and a public **How to Play** guide — every rule, side bet, and paytable, rendered live from the engine's own rules so docs can't drift. Bigger version badge. |
| 0.6.0 | 2026-07-03 | **Perfect Pairs** side bet replaces Match the Dealer (mixed 5:1 / colored 10:1 / perfect 30:1), a $1 chip joins the main rack, and **dealer tips** land — +1/+5/+25 on the result banner with a lifetime tip count next to the dealer. |
| 0.5.1 | 2026-07-03 | Version badge at the bottom-left of both sites, baked from the `VERSION` file at build time. |
| 0.5.0 | 2026-07-03 | **Match the Dealer** side bet ($1 units), **Vegas-clock table minimums** ($5 mornings → $25 evenings, on Pacific time, server-enforced), and **basic-strategy hints** — a lightbulb toggle that highlights the mathematically correct play every decision. |
| 0.4.1 | 2026-07-03 | Upgrade banner + footer link on the free static demo pointing players at the full club. |
| 0.4.0 | 2026-07-03 | **Spanish 21** variant (48-card decks, 21 always wins, surrender, bonus 21 payouts), up to **3 bot players** consuming real shoe cards with basic strategy, a **shuffle animation + sound** on every fresh shoe, and a **Hi-Lo card counter** HUD toggle (running + true count). |
| 0.3.0 | 2026-07-03 | Client-only **static build** (`static/`, same engine, localStorage chips) auto-deployed to GitHub Pages — later served at blackjack.minus-one-labs.com. |
| 0.2.0 | 2026-07-03 | Synthesized **Web Audio sound effects** (mutable), **two hands at once**, All In button, bigger bankroll economy (10k start / 2.5k daily / 1k rescue), iPhone-friendly layout. |
| 0.1.0 | 2026-07-02 | Initial release — pure server-authoritative blackjack engine (6-deck shoe, 3:2, US peek, splits/doubles/insurance), Auth.js v5 accounts, persistent chips, and the midnight-table UI. |

## License

MIT © Kendall Gelin
