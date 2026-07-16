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
4. **Tournaments** — sit-and-go: buy-in, isolated tournament stack, N hands,
   top finishers split the pot. Multi-evening project — **/grill-me first**
   (format, scheduling, prize structure).
5. **Head-to-head challenge** — "same 20 hands, same shoe" vs a friend; the
   deterministic engine makes identical shoes trivial.
6. **Invite-a-friend multiplayer table** (Kendall 2026-07-16) — player 1
   invites player 2 by email; invite lives 5 minutes or until canceled /
   replaced with another user; both sit the SAME table/shoe. Feasible today:
   engine is server-authoritative + multi-seat already; needs a Table entity
   (shared shoe, per-USER hands, turn lock), SSE or polling for live sync,
   an Invite row (expiresAt = +5min, cancel/supersede), email via SMTP
   (Notifier pattern) + in-app fallback, and turn timers (auto-stand ~30s)
   for walk-aways. Est. 2–3 evenings for 2-player. Grill the details first.

### Deepening the game
7. **Pro book (Illustrious 18)** — opt-in count deviations, graded separately.
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
