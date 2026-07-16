# Admin Console — Design (no code yet)

Design document for a pit-boss console at `/admin`. Nothing here is built;
this captures scope, auth, and data model decisions so implementation is a
mechanical follow-up. Requested 2026-07-15 ("no code, but admin console for BJ").

## Why

Today every operational task is raw SQL against the container's SQLite file
(top up a tester's chips, inspect a suspicious round, check the jackpot).
That works but is slow, error-prone, and invisible — no audit trail.

**Zero-code stopgap available now:** `npx prisma studio` against a copy of
`prisma/dev.db` pulled from the container. Read-mostly, local only, never
against the live file while the app is writing (SQLite + WAL over docker cp
is a snapshot, not a live view).

## Auth model

- Reuse the existing `User.role` column (already in the schema, default
  `"user"`) — promote by setting `role = "admin"`. No new env vars, no
  parallel auth.
- Gate at three layers:
  1. `middleware.ts` matcher adds `/admin` (redirect non-session → login).
  2. A server-side `requireAdmin()` helper in every `/admin` page + API route
     (session → user lookup → `role === "admin"` or 404 — **404, not 403**,
     so the route's existence isn't advertised).
  3. Mutating admin APIs double-check role inside the transaction.
- Session JWT should NOT carry the role (stale-role risk); look it up per
  request. Admin traffic is tiny.

## Pages (priority order)

### 1. Players (`/admin`)
Table of users: name/email, chips, rounds, win streak, trophies, trainer
accuracy, created, last round. Search by name/email. Row actions:
- **Adjust chips** (± amount + required reason)
- **Reset streak / trainer stats** (rare, but testers need it)
- **Grant/revoke achievement** (slug picker from the catalog)

### 2. Round inspector (`/admin/rounds`)
Recent rounds (filter by user, settled window, net threshold). Row expands to
the parsed `stateJson`: cards, bets, side bets, promo, payouts. This is the
"why did I get paid X?" debugging tool — read-only by design; rounds are
never edited.

### 3. House dashboard (`/admin/house`)
- Lucky Ladies pot (current amount, last hit) with a **set pot** override.
- Daily/weekly house P&L: Σ(netResult + sideNet) inverted, rounds/day,
  active players, biggest wins — the Vegas-clock helpers already exist in
  `src/lib/leaderboard.ts`.
- Promo calendar preview (from `PROMO_SCHEDULE`) with a **force promo**
  override for testing (server-side flag with expiry, not a code change).

### 4. Audit log (`/admin/audit`)
Every mutating admin action writes an `AdminAction` row. Non-negotiable —
it's what makes chip adjustments defensible on a site with leaderboards.

## Schema additions (when built)

```prisma
model AdminAction {
  id        String   @id @default(cuid())
  adminId   String   // User.id of the actor
  action    String   // "chips-adjust" | "achievement-grant" | "pot-set" | ...
  targetId  String?  // affected User.id, if any
  detail    String   // JSON: { amount, reason, before, after }
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

No other schema changes needed — everything else reads existing tables.

## API surface (when built)

`/api/admin/*` route handlers, all POST-mutations through `requireAdmin()`:

| Route | Verb | Does |
|---|---|---|
| `/api/admin/users` | GET | paged user list + aggregates |
| `/api/admin/users/:id/chips` | POST | `{delta, reason}` → tx: user update + AdminAction |
| `/api/admin/users/:id/achievements` | POST/DELETE | grant/revoke slug |
| `/api/admin/rounds` | GET | filtered round list (stateJson parsed server-side) |
| `/api/admin/jackpot` | POST | `{amount, reason}` |

Chip adjustments must ALSO write a synthetic ledger mark so the Today/Week
boards don't read an admin top-up as winnings — simplest rule: admin deltas
touch `User.chips` only, never `Round` rows, and the boards already only sum
rounds. (Verified: leaderboard aggregates rounds, not chip diffs. ✅)

## UI conventions

- Same midnight-table aesthetic, but with a persistent red "PIT BOSS" ribbon
  so an admin tab is never mistaken for play.
- Every destructive button requires a typed reason (feeds the audit log).
- No admin nav links anywhere in the public UI.

## Estimate

Players page + chips adjust + audit log ≈ one evening (v0.20.0-sized).
Round inspector + house dashboard ≈ a second evening. Nothing blocks on
infra — it ships inside the existing container.
