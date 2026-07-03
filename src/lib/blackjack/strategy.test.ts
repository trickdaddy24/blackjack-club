import { describe, it, expect } from "vitest";
import { recommendAction } from "./strategy";
import type { Card, PlayerAction, Rank, Suit } from "./engine";

function c(rank: Rank, suit: Suit = "C"): Card {
  return { rank, suit };
}

const BASIC: PlayerAction[] = ["hit", "stand"];
const FULL: PlayerAction[] = ["hit", "stand", "double", "split"];

describe("recommendAction — classic", () => {
  it("hits hard 16 vs 10, stands vs 6", () => {
    expect(recommendAction([c("10"), c("6")], c("K"), BASIC)).toBe("hit");
    expect(recommendAction([c("10"), c("6")], c("6"), BASIC)).toBe("stand");
  });

  it("doubles 11 vs 6, falls back to hit when double is illegal", () => {
    expect(recommendAction([c("6"), c("5")], c("6"), FULL)).toBe("double");
    expect(recommendAction([c("6"), c("5")], c("6"), BASIC)).toBe("hit");
  });

  it("always splits aces and eights", () => {
    expect(recommendAction([c("8", "C"), c("8", "H")], c("K"), FULL)).toBe("split");
    expect(recommendAction([c("A", "C"), c("A", "H")], c("5"), FULL)).toBe("split");
  });

  it("plays 10,10 as hard 20 (never splits)", () => {
    expect(recommendAction([c("10", "C"), c("10", "H")], c("6"), FULL)).toBe("stand");
  });

  it("soft 18 doubles vs 6 (stands when double unavailable), hits vs 10", () => {
    expect(recommendAction([c("A"), c("7")], c("6"), FULL)).toBe("double");
    expect(recommendAction([c("A"), c("7")], c("6"), BASIC)).toBe("stand");
    expect(recommendAction([c("A"), c("7")], c("K"), BASIC)).toBe("hit");
  });

  it("stands hard 12 vs 4-6, hits vs 2", () => {
    expect(recommendAction([c("10"), c("2")], c("5"), BASIC)).toBe("stand");
    expect(recommendAction([c("10"), c("2")], c("2"), BASIC)).toBe("hit");
  });

  it("always declines insurance", () => {
    expect(
      recommendAction([c("10"), c("9")], c("A"), ["insurance-yes", "insurance-no"])
    ).toBe("insurance-no");
  });
});

describe("recommendAction — spanish 21", () => {
  const SP: PlayerAction[] = ["hit", "stand", "double", "surrender"];

  it("hits hard 12 even vs 6 (stands 13 vs 6)", () => {
    expect(recommendAction([c("8"), c("4")], c("6"), SP, "spanish21")).toBe("hit");
    expect(recommendAction([c("8"), c("5")], c("6"), SP, "spanish21")).toBe("stand");
  });

  it("surrenders hard 16 vs ace when available, hits otherwise", () => {
    expect(recommendAction([c("K"), c("6")], c("A"), SP, "spanish21")).toBe("surrender");
    expect(recommendAction([c("K"), c("6")], c("A"), BASIC, "spanish21")).toBe("hit");
  });

  it("stands hard 15 vs 6, hits vs 7", () => {
    expect(recommendAction([c("K"), c("5")], c("6"), SP, "spanish21")).toBe("stand");
    expect(recommendAction([c("K"), c("5")], c("7"), SP, "spanish21")).toBe("hit");
  });

  it("doubles 10 vs 8 but not vs 9", () => {
    expect(recommendAction([c("6"), c("4")], c("8"), SP, "spanish21")).toBe("double");
    expect(recommendAction([c("6"), c("4")], c("9"), SP, "spanish21")).toBe("hit");
  });
});
