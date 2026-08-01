import { describe, expect, it } from "vitest";
import {
  ILLUSTRIOUS_18,
  deviationFor,
  explainDeviation,
  insuranceDeviation,
} from "./deviations";
import type { Card, PlayerAction } from "./engine";

const c = (rank: Card["rank"], suit: Card["suit"] = "S"): Card => ({ rank, suit } as Card);
const ALL: PlayerAction[] = ["hit", "stand", "double", "split", "surrender"];

describe("ILLUSTRIOUS_18 catalog", () => {
  it("has exactly eighteen entries, ranked 1-18 with no gaps", () => {
    expect(ILLUSTRIOUS_18).toHaveLength(18);
    expect(ILLUSTRIOUS_18.map((d) => d.rank).sort((a, b) => a - b))
      .toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });

  it("leads with insurance — the most valuable index play in the set", () => {
    expect(ILLUSTRIOUS_18[0].spot).toBe("insurance");
    expect(ILLUSTRIOUS_18[0].index).toBe(3);
  });

  it("never recommends the action basic strategy already gives", () => {
    for (const d of ILLUSTRIOUS_18) expect(d.action).not.toBe(d.basic);
  });
});

describe("insuranceDeviation", () => {
  it("declines below the index and takes it at or above +3", () => {
    expect(insuranceDeviation(2)).toBeNull();
    expect(insuranceDeviation(2.9)).toBeNull();
    expect(insuranceDeviation(3)).not.toBeNull();
    expect(insuranceDeviation(7)).not.toBeNull();
  });
});

describe("deviationFor — at-or-above entries", () => {
  it("stands 16 vs 10 at true count 0 and up, hits below", () => {
    const hand = [c("10"), c("6")];
    expect(deviationFor(hand, c("K"), -1, ALL)).toBeNull();
    expect(deviationFor(hand, c("K"), 0, ALL)?.action).toBe("stand");
    expect(deviationFor(hand, c("K"), 5, ALL)?.action).toBe("stand");
  });

  it("stands 15 vs 10 only from +4", () => {
    const hand = [c("10"), c("5")];
    expect(deviationFor(hand, c("Q"), 3, ALL)).toBeNull();
    expect(deviationFor(hand, c("Q"), 4, ALL)?.action).toBe("stand");
  });

  it("doubles 11 vs ace from +1", () => {
    const hand = [c("6"), c("5")];
    expect(deviationFor(hand, c("A"), 0, ALL)).toBeNull();
    expect(deviationFor(hand, c("A"), 1, ALL)?.action).toBe("double");
  });

  it("stands 12 vs 2 only from +3, and 12 vs 3 from +2", () => {
    const hand = [c("8"), c("4")];
    expect(deviationFor(hand, c("2"), 2, ALL)).toBeNull();
    expect(deviationFor(hand, c("2"), 3, ALL)?.action).toBe("stand");
    expect(deviationFor(hand, c("3"), 2, ALL)?.action).toBe("stand");
  });
});

describe("deviationFor — at-or-below entries", () => {
  // These reverse: the play fires as the shoe gets ten-POOR.
  it("hits 13 vs 2 at -1 and below, stands above", () => {
    const hand = [c("9"), c("4")];
    expect(deviationFor(hand, c("2"), 0, ALL)).toBeNull();
    expect(deviationFor(hand, c("2"), -1, ALL)?.action).toBe("hit");
    expect(deviationFor(hand, c("2"), -4, ALL)?.action).toBe("hit");
  });

  it("hits 12 vs 4 at 0 and below", () => {
    const hand = [c("8"), c("4")];
    expect(deviationFor(hand, c("4"), 1, ALL)).toBeNull();
    expect(deviationFor(hand, c("4"), 0, ALL)?.action).toBe("hit");
  });

  it("hits 12 vs 5 only from -2", () => {
    const hand = [c("8"), c("4")];
    expect(deviationFor(hand, c("5"), -1, ALL)).toBeNull();
    expect(deviationFor(hand, c("5"), -2, ALL)?.action).toBe("hit");
  });
});

describe("deviationFor — pairs of tens", () => {
  it("splits 10s vs 5 from +5 and vs 6 from +4", () => {
    const pair = [c("10"), c("K")];
    expect(deviationFor(pair, c("5"), 4, ALL)).toBeNull();
    expect(deviationFor(pair, c("5"), 5, ALL)?.action).toBe("split");
    expect(deviationFor(pair, c("6"), 4, ALL)?.action).toBe("split");
  });

  // A pair of tens is a hard 20 and must never match the "10" total entries.
  it("does not confuse a pair of tens with a hard 10", () => {
    const pair = [c("10"), c("Q")];
    expect(deviationFor(pair, c("K"), 9, ALL)).toBeNull();   // #6 is 10 vs 10
    expect(deviationFor(pair, c("A"), 9, ALL)).toBeNull();   // #11 is 10 vs A
  });

  it("still fires the hard-10 entries on a genuine two-card 10", () => {
    const ten = [c("6"), c("4")];
    expect(deviationFor(ten, c("K"), 4, ALL)?.action).toBe("double");
    expect(deviationFor(ten, c("A"), 4, ALL)?.action).toBe("double");
  });
});

describe("deviationFor — guards", () => {
  it("never suggests an action the table won't allow", () => {
    const hand = [c("6"), c("5")];
    // 11 vs A wants a double; without it on offer, say nothing rather than
    // recommending something the player cannot do.
    expect(deviationFor(hand, c("A"), 5, ["hit", "stand"])).toBeNull();
    const pair = [c("10"), c("K")];
    expect(deviationFor(pair, c("6"), 9, ["hit", "stand"])).toBeNull();
  });

  it("ignores soft hands entirely", () => {
    // Soft 16 (A+5) vs 10 must not match the hard-16 entry.
    expect(deviationFor([c("A"), c("5")], c("K"), 9, ALL)).toBeNull();
  });

  it("returns null for a spot with no index play", () => {
    expect(deviationFor([c("9"), c("8")], c("7"), 9, ALL)).toBeNull();
    expect(deviationFor([c("10"), c("6")], c("4"), 9, ALL)).toBeNull();
  });
});

describe("explainDeviation", () => {
  it("names the play and shows the running true count", () => {
    const d = deviationFor([c("10"), c("6")], c("K"), 2, ALL)!;
    const text = explainDeviation(d, 2);
    expect(text).toContain("Illustrious 18 #2");
    expect(text).toContain("+2");
    expect(text).toContain("hit");   // what the book would have said
  });

  it("explains insurance in terms of the dealer's blackjack odds", () => {
    const text = explainDeviation(insuranceDeviation(4)!, 4);
    expect(text).toMatch(/1 time in 3/);
    expect(text).toContain("+4");
  });

  it("renders a negative count without a stray plus sign", () => {
    const d = deviationFor([c("9"), c("4")], c("2"), -3, ALL)!;
    expect(explainDeviation(d, -3)).toContain("-3");
    expect(explainDeviation(d, -3)).not.toContain("+-3");
  });
});
