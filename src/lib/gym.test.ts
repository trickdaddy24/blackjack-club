import { describe, expect, it } from "vitest";
import { drillAnswer, GYM_LEVELS, gymLevel, ELITE_LEVELS } from "./gym";
import { advanceQuest, GYM_EVENT, questDef } from "./quests";
import type { Card, Rank, Suit } from "./blackjack/engine";

const c = (rank: Rank, suit: Suit = "C"): Card => ({ rank, suit });

describe("gym levels", () => {
  it("five levels, ascending difficulty, unique ids", () => {
    expect(GYM_LEVELS.length).toBe(5);
    expect(new Set(GYM_LEVELS.map((l) => l.id)).size).toBe(5);
    for (let i = 1; i < GYM_LEVELS.length; i++) {
      expect(GYM_LEVELS[i].cards).toBeGreaterThan(GYM_LEVELS[i - 1].cards);
      expect(GYM_LEVELS[i].speedMs).toBeLessThan(GYM_LEVELS[i - 1].speedMs);
    }
    expect(gymLevel("wizard")?.cards).toBe(52);
    expect(ELITE_LEVELS.has("pro") && ELITE_LEVELS.has("wizard")).toBe(true);
  });
});

describe("drillAnswer", () => {
  it("sums Hi-Lo: low cards +1, tens/aces -1, 7-9 zero", () => {
    expect(drillAnswer([c("2"), c("6"), c("K"), c("A"), c("8")])).toBe(0);
    expect(drillAnswer([c("3"), c("4"), c("5")])).toBe(3);
    expect(drillAnswer([c("10"), c("J"), c("Q")])).toBe(-3);
    expect(drillAnswer([])).toBe(0);
  });
});

describe("gym quest event", () => {
  it("advances gym-1 only", () => {
    expect(advanceQuest(questDef("gym-1")!, 0, GYM_EVENT)).toBe(1);
    expect(advanceQuest(questDef("play-5")!, 2, GYM_EVENT)).toBe(2); // not a table round
    expect(advanceQuest(questDef("win-3")!, 1, GYM_EVENT)).toBe(1);
  });

  it("does NOT break a live Back to Back run", () => {
    expect(advanceQuest(questDef("run-2")!, 1, GYM_EVENT)).toBe(1); // preserved, not reset
  });

  it("table settles never advance gym-1", () => {
    expect(
      advanceQuest(questDef("gym-1")!, 0, { won: true, blackjack: true, sideWin: true, doubledWin: true, duo: true, bustWin: true })
    ).toBe(0);
  });
});
