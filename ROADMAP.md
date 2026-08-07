# Improvement Suggestions for Blackjack Club

The project is already excellent — real casino rules, persistent chips, daily bonuses,
solid engine, great aesthetics, sounds, and even Spanish 21 support. Here's how to make
it **significantly more fun and engaging** while keeping the play-money spirit.

> Items marked ✅ have shipped — see the [Version History](./README.md#version-history).

## Ideas Board — 2026-07-16 (prioritized, none started)

### Retention & daily habit
1. **Daily quests + login streaks** ⭐ *top pick* — rotating quests on the Vegas
   clock ("win 3 hands", "hit any side bet"), chip rewards scaling with login
   streak. Achievements already built the settle-time hooks + toast pipeline.
2. **Chip wheel** — free daily spin, weighted segments, rare jackpot slice.
3. **Weekly board champion** — automatic chip prize + exclusive badge when the
   Today/Week/Strategy Masters window closes. Boards become a competition.

### Competition
4. **Tournaments** ✅ *(v0.47.0 — Sit-and-Go: 1,000-chip buy-in off main chips,
   isolated per-entrant stack, fixed 20 hands, no side bets, 3–8 entrants,
   auto-start at 8 or manual start at 3+, self-paced with a 24h forfeit-in-place
   deadline and a 1h idle-lobby auto-cancel (both lazy, no cron), live
   leaderboard, 60/40 prize split with tie handling.)*
5. **Head-to-head challenge** — "same 20 hands, same shoe" vs a friend; the
   deterministic engine makes identical shoes trivial.
6. **Invite-a-friend multiplayer table** ✅ *(v0.21.0 — Duo Table: 2 players,
   members-only invites w/ 5-min hold + supersede, in-app bell + env-gated
   email, 30s auto-stand clock, host kick/end, full side bets incl. the
   progressive, per-player rounds/streaks/achievements. The Table/Invite
   social layer is game-agnostic — Spades/Wild Card multiplayer = engine
   port only.)*
   - **Spades multiplayer** ✅ *(v0.48.0 — issue #1: partnership Spades to 500,
     you + a friend (seats 0 & 2) vs two bots (seats 1 & 3, fixed — no lobby).
     New `SpadesTable`/`SpadesInvite` models rather than extending `Table`
     (which is hard-wired to 2 seats + blackjack money fields). The existing
     `/spades` reducer and bot AI run server-side unmodified; the bot AI also
     supplies the forced move when a human's 30s clock expires. New per-seat
     `spadesClientView()` — your hand in full, every other seat as a card
     count only. Accepting the invite auto-starts the table immediately.)*

### Deepening the game
7. **Pro book (Illustrious 18)** ✅ *(v0.49.0 — issue #9: opt-in count
   deviations, classic table only, graded on a separate `ProBookStat`
   scorecard so Strategy Masters' basic-strategy meaning never shifts. Wires
   the existing, already-tested `deviations.ts` library into `withHint()`
   rather than reimplementing the math; `proBookActive(variant, enabled)` is
   the single gate shared by the on-screen hint and the grading write.)*
8. **Full-fidelity Spanish 21 strategy chart** (currently honest simplification).
9. **New side bets** — Blazing-777s-style (7s count, could feed a SECOND
   progressive pot) or Lucky Lucky; instant-payout pattern makes these cheap.

### Visual & personalization
10. **Table themes / earned card backs** — unlocked BY achievements (jackpot →
    gold card backs). Hold until Kendall's perfect-pair WIP lands (GameTable surgery).

### Console & housekeeping
11. **Admin slice 2** — round inspector + house dashboard (see docs/ADMIN-CONSOLE.md).
12. **Small fixes** — /spades + /roulette hydration bug (same as fixed /wildcard),
    promo-banner countdown hydration mismatch at promo boundaries, sound for the
    standalone Wild Card Pages build.

## Top Recommendations (Prioritized)

### 1. More Side Bets & Instant Gratification (High Impact)
- Add **Perfect Pairs** ✅ *(v0.6.0)*, **21+3**, **Lucky Lucky**, or **Blazing 777s**-style progressives.
- Make side bets pay **instantly** on the deal with flashy animations, particle effects (sparkles, glows), and satisfying sounds. ✅ *(v0.8.0 — instant payout, color-cycling glow, sparkle sound)*
- Implement a **shared progressive jackpot** that grows across all players.

### 2. Social & Competitive Features
- **Multiplayer tables** — play with friends or random players + chat. *(Simulated bot players shipped in v0.4.0.)*
- Expanded **leaderboards**: Daily/Weekly/All-Time, biggest win streaks, win rate. *(All-time chip-stack board shipped in v0.7.0 ✅ — more categories to come.)*
- **Achievements & Badges**: "Blackjack Master", "Lucky 7s", "High Roller", "Comeback Kid".
- **Clubs/Guilds** or friend lists with shared bonuses.

### 3. Game Variants & Modes
- Dedicated **Spanish 21** tables ✅ *(v0.4.0)* — expand on current implementation.
- **High Roller** tables with higher limits and exclusive visuals. *(Vegas-clock minimums shipped in v0.5.0 as a first step.)*
- **Tournaments** (sit-and-go or scheduled events with chip prizes).
- Practice / Free Play vs Competitive modes.

### 4. Visuals, Polish & Immersion
- Multiple **table themes** (Vegas, Neon, Classic Felt, etc.).
- Enhanced animations: smoother card flips, chip stacking ✅ *(felt chip stacks, v0.8.0)*, win explosions.
- Customizable avatars, card backs, and felt colors (earned via play).
- Animated dealer with reactions or simple live dealer option.

### 5. Economy & Player Retention
- More **daily/weekly quests** and login streaks.
- **Referral system** for bonus chips.
- Limited **chip gifting** between friends.
- Mini side activities (e.g., chip wheel spin).

### 6. Quick Wins (Easy to Implement)
- Add 2–3 new side bets with instant payouts. *(21+3 is the natural next one.)*
- Improve leaderboard with more categories.
- Add basic achievements system.
- More particle/sound effects on big wins.
- Theme switcher in settings.

## Why These Changes Matter

These additions turn a great single-player blackjack sim into a **social casino
experience** — more addictive, replayable, and shareable, without introducing real money.

The current architecture (server-authoritative engine) is perfect for scaling these
features safely.
