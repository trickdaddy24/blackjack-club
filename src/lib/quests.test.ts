import { describe, expect, it } from "vitest";
import {
  advanceQuest,
  CLEAN_SWEEP,
  CLEAN_SWEEP_SLUG,
  dailyQuests,
  isCleanSweep,
  previousDayKey,
  questDef,
  QUESTS,
  settleEventFor,
  sweepStreak,
  type SettleEvent,
} from "./quests";
import type { HandState, RoundState } from "./blackjack/engine";

const ev = (over: Partial<SettleEvent> = {}): SettleEvent => ({
  won: false,
  blackjack: false,
  sideWin: false,
  doubledWin: false,
  duo: false,
  bustWin: false,
  ...over,
});

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

function round(over: Partial<RoundState> = {}): RoundState {
  const hands = over.hands ?? [hand()];
  return {
    shoe: [],
    dealer: [],
    dealerRevealed: true,
    hands,
    active: hands.length,
    phase: "settled",
    baseBet: 100,
    insuranceBet: 0,
    splits: 0,
    staked: hands.reduce((s, h) => s + h.bet, 0),
    payoutTotal: hands.reduce((s, h) => s + h.payout, 0),
    variant: "classic",
    runningCount: 0,
    bots: [],
    bustBet: 0,
    ...over,
  };
}

describe("dailyQuests", () => {
  it("always includes Grinder's Shift plus two distinct others, deterministically", () => {
    for (const day of ["2026-07-16", "2026-07-17", "2026-12-31", "2027-01-01"]) {
      const a = dailyQuests(day);
      const b = dailyQuests(day);
      expect(a.map((q) => q.slug)).toEqual(b.map((q) => q.slug));
      expect(a[0].slug).toBe("play-5");
      expect(new Set(a.map((q) => q.slug)).size).toBe(3);
    }
  });

  it("rotates the two picks across days", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const day = `2026-08-${String(d).padStart(2, "0")}`;
      for (const q of dailyQuests(day)) seen.add(q.slug);
    }
    expect(seen.size).toBeGreaterThan(4); // variety over a month
  });
});

describe("advanceQuest", () => {
  it("play-5 counts every settle; win-3 counts wins only", () => {
    expect(advanceQuest(questDef("play-5")!, 2, ev())).toBe(3);
    expect(advanceQuest(questDef("win-3")!, 1, ev({ won: true }))).toBe(2);
    expect(advanceQuest(questDef("win-3")!, 1, ev())).toBe(1);
  });

  it("run-2 resets on a loss", () => {
    expect(advanceQuest(questDef("run-2")!, 1, ev({ won: true }))).toBe(2);
    expect(advanceQuest(questDef("run-2")!, 1, ev({ won: false }))).toBe(0);
  });

  it("event quests advance only on their event", () => {
    expect(advanceQuest(questDef("natural-1")!, 0, ev({ blackjack: true }))).toBe(1);
    expect(advanceQuest(questDef("side-1")!, 0, ev({ sideWin: true }))).toBe(1);
    expect(advanceQuest(questDef("double-1")!, 0, ev({ doubledWin: true }))).toBe(1);
    expect(advanceQuest(questDef("duo-1")!, 0, ev({ duo: true }))).toBe(1);
    expect(advanceQuest(questDef("bust-1")!, 0, ev({ bustWin: true }))).toBe(1);
    expect(advanceQuest(questDef("bust-1")!, 0, ev())).toBe(0);
  });
});

describe("settleEventFor", () => {
  it("solo: reads the whole round including the bust bet", () => {
    const s = round({
      hands: [hand({ outcome: "blackjack", payout: 250, pp: { bet: 5, payout: 30, label: "mixed pair" } })],
      bustBet: 50,
      bustPayout: 100,
    });
    const e = settleEventFor(s);
    expect(e.won).toBe(true);
    expect(e.blackjack).toBe(true);
    expect(e.sideWin).toBe(true);
    expect(e.bustWin).toBe(true);
    expect(e.duo).toBe(false);
  });

  it("duo: scopes to the owner and never sees bust bets", () => {
    const s = round({
      hands: [
        hand({ owner: 0, outcome: "lose", payout: 0 }),
        hand({ owner: 1, outcome: "blackjack", payout: 250 }),
      ],
    });
    const host = settleEventFor(s, 0);
    const guest = settleEventFor(s, 1);
    expect(host.won).toBe(false);
    expect(host.blackjack).toBe(false);
    expect(host.duo).toBe(true);
    expect(guest.won).toBe(true);
    expect(guest.blackjack).toBe(true);
  });
});

describe("catalog", () => {
  it("slugs are unique and rewards positive", () => {
    expect(new Set(QUESTS.map((q) => q.slug)).size).toBe(QUESTS.length);
    for (const q of QUESTS) {
      expect(q.reward).toBeGreaterThan(0);
      expect(q.target).toBeGreaterThan(0);
    }
  });
});

// ── Clean Sweep (#7) ───────────────────────────────────────────────────────

describe("isCleanSweep", () => {
  const defs = dailyQuests("2026-07-28");

  it("is false until every one of the day's quests is done", () => {
    expect(isCleanSweep(defs, [])).toBe(false);
    expect(isCleanSweep(defs, [defs[0].slug])).toBe(false);
    expect(isCleanSweep(defs, [defs[0].slug, defs[1].slug])).toBe(false);
  });

  it("is true once all three are done", () => {
    expect(isCleanSweep(defs, defs.map((d) => d.slug))).toBe(true);
  });

  it("ignores completed quests that aren't on today's board", () => {
    // A quest finished before the board rotated must not count toward today.
    const stale = ["gym-1", "bust-1", "duo-1", "natural-1"];
    const onlyStale = stale.filter((s) => !defs.some((d) => d.slug === s));
    expect(isCleanSweep(defs, onlyStale)).toBe(false);
  });

  it("is false for an empty board rather than vacuously true", () => {
    expect(isCleanSweep([], [])).toBe(false);
  });
});

describe("previousDayKey", () => {
  it("steps back one day", () => {
    expect(previousDayKey("2026-07-28")).toBe("2026-07-27");
  });
  it("crosses month and year boundaries", () => {
    expect(previousDayKey("2026-08-01")).toBe("2026-07-31");
    expect(previousDayKey("2026-01-01")).toBe("2025-12-31");
    expect(previousDayKey("2026-03-01")).toBe("2026-02-28");
  });
  it("handles a leap day", () => {
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
  });
});

describe("sweepStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(sweepStreak(["2026-07-28", "2026-07-27", "2026-07-26"], "2026-07-28")).toBe(3);
  });

  it("stops at the first gap", () => {
    expect(
      sweepStreak(["2026-07-28", "2026-07-27", "2026-07-25"], "2026-07-28")
    ).toBe(2);
  });

  // Mid-day, before today's sweep lands, the streak should read as yesterday's
  // run rather than collapsing to 0 and jumping back up an hour later.
  it("still counts yesterday's run when today isn't swept yet", () => {
    expect(sweepStreak(["2026-07-27", "2026-07-26"], "2026-07-28")).toBe(2);
  });

  it("is 0 with no sweeps, or when the run ended before yesterday", () => {
    expect(sweepStreak([], "2026-07-28")).toBe(0);
    expect(sweepStreak(["2026-07-20"], "2026-07-28")).toBe(0);
  });

  it("counts a single day", () => {
    expect(sweepStreak(["2026-07-28"], "2026-07-28")).toBe(1);
  });

  it("is unaffected by duplicate or unordered input", () => {
    expect(
      sweepStreak(["2026-07-26", "2026-07-28", "2026-07-27", "2026-07-27"], "2026-07-28")
    ).toBe(3);
  });

  it("crosses a month boundary", () => {
    expect(sweepStreak(["2026-08-01", "2026-07-31", "2026-07-30"], "2026-08-01")).toBe(3);
  });
});

describe("CLEAN_SWEEP catalog", () => {
  it("uses a slug that can never collide with a real quest", () => {
    expect(QUESTS.some((q) => q.slug === CLEAN_SWEEP_SLUG)).toBe(false);
  });
  it("pays more than any single daily quest", () => {
    expect(CLEAN_SWEEP.reward).toBeGreaterThan(Math.max(...QUESTS.map((q) => q.reward)));
  });
});
