import { describe, expect, it } from "vitest";
import {
  advanceQuest,
  dailyQuests,
  questDef,
  QUESTS,
  settleEventFor,
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
