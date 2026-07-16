import { describe, expect, it } from "vitest";
import type { HandState, RoundState } from "./blackjack/engine";
import {
  ACHIEVEMENTS,
  achievementDef,
  earnedFromTrainer,
  earnedThisSettle,
  nextWinStreak,
  type SettleContext,
} from "./achievements";

/** Minimal settled hand — override what the scenario needs. */
function hand(over: Partial<HandState> = {}): HandState {
  return {
    cards: [],
    bet: 100,
    doubled: false,
    done: true,
    fromSplit: false,
    splitAces: false,
    outcome: "win",
    payout: 200,
    ...over,
  };
}

/** Minimal settled round — hands win by default, staked/payout consistent. */
function round(over: Partial<RoundState> = {}): RoundState {
  const hands = over.hands ?? [hand()];
  const staked = hands.reduce((s, h) => s + h.bet, 0);
  const payoutTotal = hands.reduce((s, h) => s + h.payout, 0);
  return {
    shoe: [],
    dealer: [],
    dealerRevealed: true,
    hands,
    active: hands.length,
    phase: "settled",
    baseBet: hands[0]?.bet ?? 100,
    insuranceBet: 0,
    splits: 0,
    staked,
    payoutTotal,
    variant: "classic",
    runningCount: 0,
    bots: [],
    bustBet: 0,
    ...over,
  };
}

function ctx(over: Partial<SettleContext> = {}): SettleContext {
  return {
    state: round(),
    jackpotWon: 0,
    chipsAfter: 10_000,
    chipsBeforePayout: 9_800,
    winStreak: 1,
    roundsPlayed: 50,
    ...over,
  };
}

describe("catalog", () => {
  it("has unique slugs and every slug resolves", () => {
    const slugs = ACHIEVEMENTS.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(achievementDef(s)?.slug).toBe(s);
  });
});

describe("earnedThisSettle", () => {
  it("first round earns first-hand; milestones stack at 100 and 1000", () => {
    expect(earnedThisSettle(ctx({ roundsPlayed: 1 }))).toContain("first-hand");
    const at100 = earnedThisSettle(ctx({ roundsPlayed: 100 }));
    expect(at100).toContain("grinder-100");
    expect(at100).not.toContain("grinder-1000");
    expect(earnedThisSettle(ctx({ roundsPlayed: 1000 }))).toContain("grinder-1000");
  });

  it("natural blackjack earns The Natural; 2:1 promo adds Golden Hour", () => {
    const bj = round({ hands: [hand({ outcome: "blackjack", payout: 250 })] });
    expect(earnedThisSettle(ctx({ state: bj }))).toContain("natural");
    expect(earnedThisSettle(ctx({ state: bj }))).not.toContain("golden-hour");
    const promo = round({
      hands: [hand({ outcome: "blackjack", payout: 300 })],
      promo: "happy-hour",
    });
    expect(earnedThisSettle(ctx({ state: promo }))).toContain("golden-hour");
    // Even money during happy hour is NOT the 2:1 blackjack
    const even = round({
      hands: [hand({ outcome: "even-money", payout: 200 })],
      promo: "happy-hour",
    });
    const earned = earnedThisSettle(ctx({ state: even }));
    expect(earned).toContain("natural");
    expect(earned).not.toContain("golden-hour");
  });

  it("doubled win earns Double Trouble; doubled loss doesn't", () => {
    const win = round({ hands: [hand({ doubled: true, bet: 200, payout: 400 })] });
    expect(earnedThisSettle(ctx({ state: win }))).toContain("double-win");
    const loss = round({ hands: [hand({ doubled: true, outcome: "lose", payout: 0 })] });
    expect(earnedThisSettle(ctx({ state: loss }))).not.toContain("double-win");
  });

  it("split sweep needs EVERY split hand to win", () => {
    const sweep = round({
      hands: [hand({ fromSplit: true }), hand({ fromSplit: true })],
      splits: 1,
    });
    expect(earnedThisSettle(ctx({ state: sweep }))).toContain("split-sweep");
    const partial = round({
      hands: [hand({ fromSplit: true }), hand({ fromSplit: true, outcome: "lose", payout: 0 })],
      splits: 1,
    });
    expect(earnedThisSettle(ctx({ state: partial }))).not.toContain("split-sweep");
    // A lone non-split winning hand is not a sweep
    expect(earnedThisSettle(ctx())).not.toContain("split-sweep");
  });

  it("streak trophies key off the post-round streak", () => {
    expect(earnedThisSettle(ctx({ winStreak: 4 }))).not.toContain("hot-streak-5");
    const at5 = earnedThisSettle(ctx({ winStreak: 5 }));
    expect(at5).toContain("hot-streak-5");
    expect(at5).not.toContain("hot-streak-10");
    expect(earnedThisSettle(ctx({ winStreak: 10 }))).toContain("hot-streak-10");
  });

  it("comeback and all-in look at chips left behind on a winning round", () => {
    expect(earnedThisSettle(ctx({ chipsBeforePayout: 999 }))).toContain("comeback-kid");
    expect(earnedThisSettle(ctx({ chipsBeforePayout: 1000 }))).not.toContain("comeback-kid");
    const allIn = earnedThisSettle(ctx({ chipsBeforePayout: 0 }));
    expect(allIn).toContain("all-in-win");
    expect(allIn).toContain("comeback-kid");
    // Losing round with an empty pocket earns nothing
    const losing = round({ hands: [hand({ outcome: "lose", payout: 0 })] });
    const lost = earnedThisSettle(ctx({ state: losing, chipsBeforePayout: 0 }));
    expect(lost).not.toContain("all-in-win");
    expect(lost).not.toContain("comeback-kid");
  });

  it("stack milestones fire at 100k and 1M", () => {
    expect(earnedThisSettle(ctx({ chipsAfter: 99_999 }))).not.toContain("high-roller-100k");
    expect(earnedThisSettle(ctx({ chipsAfter: 100_000 }))).toContain("high-roller-100k");
    expect(earnedThisSettle(ctx({ chipsAfter: 1_000_000 }))).toContain("millionaire");
  });

  it("side-bet wins earn Side Show, with specials for PP/trips/jackpot/bust", () => {
    const pp = round({
      hands: [hand({ pp: { bet: 10, payout: 310, label: "perfect pair" } })],
    });
    const ppEarned = earnedThisSettle(ctx({ state: pp }));
    expect(ppEarned).toContain("side-show");
    expect(ppEarned).toContain("perfect-pair");

    const mixed = round({
      hands: [hand({ pp: { bet: 10, payout: 60, label: "mixed pair" } })],
    });
    expect(earnedThisSettle(ctx({ state: mixed }))).not.toContain("perfect-pair");

    const trips = round({
      hands: [hand({ tp: { bet: 10, payout: 1010, label: "suited trips" } })],
    });
    expect(earnedThisSettle(ctx({ state: trips }))).toContain("suited-trips");

    const lostSide = round({
      hands: [hand({ pp: { bet: 10, payout: 0, label: "no pair" } })],
    });
    expect(earnedThisSettle(ctx({ state: lostSide }))).not.toContain("side-show");

    expect(earnedThisSettle(ctx({ jackpotWon: 31_000 }))).toContain("queens-crown");

    const bust = round({ bustBet: 50, bustPayout: 100 });
    const bustEarned = earnedThisSettle(ctx({ state: bust }));
    expect(bustEarned).toContain("bust-prophet");
    expect(bustEarned).toContain("side-show");
    const bustLost = round({ bustBet: 50, bustPayout: 0 });
    expect(earnedThisSettle(ctx({ state: bustLost }))).not.toContain("bust-prophet");
  });

  it("only returns slugs that exist in the catalog", () => {
    const everything = earnedThisSettle(
      ctx({
        state: round({
          hands: [
            hand({
              outcome: "blackjack",
              doubled: true,
              pp: { bet: 10, payout: 310, label: "perfect pair" },
              tp: { bet: 10, payout: 1010, label: "suited trips" },
            }),
          ],
          promo: "happy-hour",
          bustBet: 50,
          bustPayout: 100,
        }),
        jackpotWon: 31_000,
        chipsAfter: 1_000_000,
        chipsBeforePayout: 0,
        winStreak: 10,
        roundsPlayed: 1000,
      })
    );
    for (const slug of everything) expect(achievementDef(slug)).toBeDefined();
  });
});

describe("earnedFromTrainer", () => {
  it("Book Smart needs a best streak of 25", () => {
    expect(earnedFromTrainer({ right: 24, wrong: 0, best: 24 })).not.toContain("book-smart-25");
    expect(earnedFromTrainer({ right: 25, wrong: 0, best: 25 })).toContain("book-smart-25");
  });

  it("By the Book needs 90% over 100+ decisions", () => {
    expect(earnedFromTrainer({ right: 89, wrong: 10, best: 5 })).not.toContain("by-the-book");
    expect(earnedFromTrainer({ right: 90, wrong: 10, best: 5 })).toContain("by-the-book");
    expect(earnedFromTrainer({ right: 9, wrong: 1, best: 5 })).not.toContain("by-the-book");
  });
});

describe("nextWinStreak", () => {
  it("wins extend, losses reset, pushes carry", () => {
    expect(nextWinStreak(3, 150)).toBe(4);
    expect(nextWinStreak(3, -100)).toBe(0);
    expect(nextWinStreak(3, 0)).toBe(3);
    expect(nextWinStreak(0, 100)).toBe(1);
  });
});
