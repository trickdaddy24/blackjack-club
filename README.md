# ♠ Blackjack Club

A play-money blackjack site in the spirit of Zynga Poker — real casino rules, persistent
chip balances, daily free chips, and a dim, gold-on-felt "midnight table" aesthetic.
**No real money, no purchases, no payouts — just cards.**

## Features

- **Full standard blackjack** — 6-deck shoe (75% penetration reshuffle), blackjack pays 3:2,
  US peek, dealer stands on all 17s, hit/stand/double/split, one re-split, split aces get one
  card, double after split, insurance pays 2:1.
- **Server-authoritative engine** — all game logic runs server-side; the client only renders
  state and sends actions. The dealer's hole card and the shoe are never sent over the wire
  until reveal, and chip balances mutate in the same DB transaction as round state.
- **Accounts & persistent chips** — Auth.js v5 (email/password, optional Google OAuth),
  10,000 starting chips, +2,500 daily bonus, house rescue stake when you bust out.
- **Two hands at once** — seat selector deals casino-style and plays hands left to right;
  plus an **All In** button for the brave.
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

## License

MIT © Kendall Gelin
