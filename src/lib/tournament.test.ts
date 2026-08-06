import { describe, it, expect } from "vitest";
import {
  canBackOut,
  canJoinLobby,
  canManualStart,
  canStillPlay,
  checkTournamentBet,
  isEntryComplete,
  isLobbyIdleExpired,
  isPastDeadline,
  MAX_ENTRANTS,
  MIN_ENTRANTS,
  rankAndPayout,
  rejectSideBets,
  shouldAutoStart,
  splitEvenly,
  TOURNAMENT_MAX_BET,
  TOURNAMENT_MIN_BET,
  tournamentDeadline,
  COMPLETION_DEADLINE_MS,
} from "./tournament";

describe("lobby join / start state machine", () => {
  it("allows joining an open lobby under the max", () => {
    expect(canJoinLobby("open", 0)).toBe(true);
    expect(canJoinLobby("open", MAX_ENTRANTS - 1)).toBe(true);
  });

  it("blocks joining once full or once the lobby isn't open", () => {
    expect(canJoinLobby("open", MAX_ENTRANTS)).toBe(false);
    expect(canJoinLobby("active", 3)).toBe(false);
    expect(canJoinLobby("settled", 3)).toBe(false);
    expect(canJoinLobby("canceled", 0)).toBe(false);
  });

  it("auto-starts exactly at the max, not before", () => {
    expect(shouldAutoStart(MAX_ENTRANTS - 1)).toBe(false);
    expect(shouldAutoStart(MAX_ENTRANTS)).toBe(true);
  });

  it("manual start requires the 3-entrant floor", () => {
    expect(canManualStart(MIN_ENTRANTS - 1)).toBe(false);
    expect(canManualStart(MIN_ENTRANTS)).toBe(true);
    expect(canManualStart(MAX_ENTRANTS)).toBe(true);
  });

  it("back-out is only clean pre-start", () => {
    expect(canBackOut("open")).toBe(true);
    expect(canBackOut("active")).toBe(false);
    expect(canBackOut("settled")).toBe(false);
    expect(canBackOut("canceled")).toBe(false);
  });
});

describe("idle-lobby and deadline expiry", () => {
  it("flags a lobby idle only once the full window has elapsed", () => {
    const lastJoin = new Date("2026-01-01T00:00:00Z");
    const justUnder = new Date(lastJoin.getTime() + 59 * 60 * 1000);
    const atWindow = new Date(lastJoin.getTime() + 60 * 60 * 1000);
    expect(isLobbyIdleExpired(lastJoin, justUnder)).toBe(false);
    expect(isLobbyIdleExpired(lastJoin, atWindow)).toBe(true);
  });

  it("computes the 24h deadline from the start time", () => {
    const started = new Date("2026-01-01T00:00:00Z");
    expect(tournamentDeadline(started).getTime()).toBe(
      started.getTime() + COMPLETION_DEADLINE_MS
    );
  });

  it("treats a null deadline as never past", () => {
    expect(isPastDeadline(null, new Date())).toBe(false);
  });

  it("flags past-deadline only at or after the deadline", () => {
    const deadline = new Date("2026-01-02T00:00:00Z");
    expect(isPastDeadline(deadline, new Date(deadline.getTime() - 1))).toBe(false);
    expect(isPastDeadline(deadline, deadline)).toBe(true);
    expect(isPastDeadline(deadline, new Date(deadline.getTime() + 1))).toBe(true);
  });
});

describe("hand-play eligibility", () => {
  it("an entry is complete once it reaches the fixed hand count", () => {
    expect(isEntryComplete(19)).toBe(false);
    expect(isEntryComplete(20)).toBe(true);
    expect(isEntryComplete(21)).toBe(true);
  });

  it("can't play on once busted below the minimum bet", () => {
    expect(canStillPlay(4, 5)).toBe(false);
    expect(canStillPlay(5, 5)).toBe(true);
  });

  it("can't play on once all hands are used, regardless of stack", () => {
    expect(canStillPlay(1000, 20)).toBe(false);
  });
});

describe("checkTournamentBet", () => {
  it("rejects non-integers and out-of-range bets", () => {
    expect(checkTournamentBet(4.5, 1000).ok).toBe(false);
    expect(checkTournamentBet("50", 1000).ok).toBe(false);
    expect(checkTournamentBet(TOURNAMENT_MIN_BET - 1, 1000).ok).toBe(false);
    expect(checkTournamentBet(TOURNAMENT_MAX_BET + 1, 2_000_000).ok).toBe(false);
  });

  it("rejects a bet bigger than the isolated stack", () => {
    const result = checkTournamentBet(500, 100);
    expect(result.ok).toBe(false);
  });

  it("accepts a legal bet within the stack", () => {
    const result = checkTournamentBet(500, 1000);
    expect(result).toEqual({ ok: true, bet: 500 });
  });

  it("accepts an all-in bet exactly equal to the stack", () => {
    expect(checkTournamentBet(37, 37).ok).toBe(true);
  });
});

describe("rejectSideBets", () => {
  it("passes when every side bet is zero or absent", () => {
    expect(rejectSideBets({})).toBeNull();
    expect(rejectSideBets({ perfectPairs: 0, twentyOnePlusThree: 0, luckyLadies: 0 })).toBeNull();
  });

  it("rejects any nonzero side bet", () => {
    expect(rejectSideBets({ perfectPairs: 5 })).not.toBeNull();
    expect(rejectSideBets({ twentyOnePlusThree: 1 })).not.toBeNull();
    expect(rejectSideBets({ luckyLadies: 25 })).not.toBeNull();
  });
});

describe("splitEvenly", () => {
  it("splits a clean multiple exactly", () => {
    const out = splitEvenly(100, ["a", "b"]);
    expect(out.get("a")).toBe(50);
    expect(out.get("b")).toBe(50);
  });

  it("conserves every chip when it doesn't divide evenly", () => {
    const ids = ["c", "a", "b"];
    const out = splitEvenly(100, ids);
    const total = [...out.values()].reduce((s, v) => s + v, 0);
    expect(total).toBe(100);
    // deterministic: remainder goes to the lexicographically-first ids
    expect(out.get("a")).toBe(34);
    expect(out.get("b")).toBe(33);
    expect(out.get("c")).toBe(33);
  });

  it("returns an empty map for zero ids", () => {
    expect(splitEvenly(500, []).size).toBe(0);
  });
});

describe("rankAndPayout", () => {
  it("pays a clean 60/40 to distinct 1st and 2nd, nothing else", () => {
    const entries = [
      { id: "a", finalStack: 3000 },
      { id: "b", finalStack: 2000 },
      { id: "c", finalStack: 500 },
    ];
    const ranked = rankAndPayout(entries, 3000);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
    expect(byId.a).toMatchObject({ rank: 1, prize: 1800 });
    expect(byId.b).toMatchObject({ rank: 2, prize: 1200 });
    expect(byId.c).toMatchObject({ rank: 3, prize: 0 });
    expect(ranked.reduce((s, r) => s + r.prize, 0)).toBe(3000);
  });

  it("handles a full 8-entrant field — only 1st and 2nd get paid", () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      finalStack: 8000 - i * 500,
    }));
    const ranked = rankAndPayout(entries, 8000);
    const sorted = [...ranked].sort((a, b) => a.rank - b.rank);
    expect(sorted[0].prize).toBe(4800);
    expect(sorted[1].prize).toBe(3200);
    for (let i = 2; i < 8; i++) expect(sorted[i].prize).toBe(0);
    expect(ranked.reduce((s, r) => s + r.prize, 0)).toBe(8000);
  });

  it("splits a 2-way tie for 1st across both the 60% and 40% slots (50/50)", () => {
    const entries = [
      { id: "a", finalStack: 1500 },
      { id: "b", finalStack: 1500 },
      { id: "c", finalStack: 800 },
      { id: "d", finalStack: 400 },
    ];
    const ranked = rankAndPayout(entries, 4000);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
    expect(byId.a.rank).toBe(1);
    expect(byId.b.rank).toBe(1);
    expect(byId.a.prize).toBe(2000);
    expect(byId.b.prize).toBe(2000);
    // no one occupies rank 2 — next distinct entrant is ranked 3rd
    expect(byId.c.rank).toBe(3);
    expect(byId.c.prize).toBe(0);
    expect(byId.d.rank).toBe(4);
    expect(ranked.reduce((s, r) => s + r.prize, 0)).toBe(4000);
  });

  it("splits a 2-way tie for 2nd across just the 40% slot", () => {
    const entries = [
      { id: "a", finalStack: 2000 },
      { id: "b", finalStack: 1000 },
      { id: "c", finalStack: 1000 },
    ];
    const ranked = rankAndPayout(entries, 3000);
    const byId = Object.fromEntries(ranked.map((r) => [r.id, r]));
    expect(byId.a).toMatchObject({ rank: 1, prize: 1800 });
    expect(byId.b).toMatchObject({ rank: 2, prize: 600 });
    expect(byId.c).toMatchObject({ rank: 2, prize: 600 });
    expect(ranked.reduce((s, r) => s + r.prize, 0)).toBe(3000);
  });

  it("splits a 3-way tie for 1st across the full pool, remainder handled deterministically", () => {
    const entries = [
      { id: "b", finalStack: 900 },
      { id: "a", finalStack: 900 },
      { id: "c", finalStack: 900 },
      { id: "d", finalStack: 300 },
      { id: "e", finalStack: 100 },
    ];
    const ranked = rankAndPayout(entries, 5000);
    const tied = ranked.filter((r) => r.rank === 1);
    expect(tied).toHaveLength(3);
    expect(tied.reduce((s, r) => s + r.prize, 0)).toBe(5000);
    // 5000 / 3 = 1666 remainder 2 -> two get 1667, one gets 1666
    const prizes = tied.map((r) => r.prize).sort((x, y) => x - y);
    expect(prizes).toEqual([1666, 1667, 1667]);
    const untied = ranked.filter((r) => r.rank !== 1);
    for (const r of untied) expect(r.prize).toBe(0);
  });

  it("pays everyone nothing gracefully when the field is empty", () => {
    expect(rankAndPayout([], 3000)).toEqual([]);
  });

  it("gives the sole entrant the whole pool when only one remains ranked", () => {
    const ranked = rankAndPayout([{ id: "solo", finalStack: 1000 }], 3000);
    expect(ranked).toEqual([{ id: "solo", finalStack: 1000, rank: 1, prize: 3000 }]);
  });

  it("splits the whole pool when every remaining entrant ties", () => {
    const entries = [
      { id: "a", finalStack: 1000 },
      { id: "b", finalStack: 1000 },
      { id: "c", finalStack: 1000 },
    ];
    const ranked = rankAndPayout(entries, 3000);
    expect(ranked.every((r) => r.rank === 1)).toBe(true);
    expect(ranked.reduce((s, r) => s + r.prize, 0)).toBe(3000);
  });
});
