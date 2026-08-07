import { describe, it, expect } from "vitest";
import { explainAction, proBookActive, recommendAction, withHint } from "./strategy";
import { clientView, startRound, type Card, type PlayerAction, type Rank, type Suit } from "./engine";

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

describe("explainAction", () => {
  it("explains standing on a stiff hand against a weak dealer", () => {
    const why = explainAction([c("10"), c("6")], c("6"), "stand");
    expect(why).toMatch(/bust/i);
    expect(why).toContain("6");
  });

  it("explains standing on 17+ differently (no bust-the-dealer talk)", () => {
    const why = explainAction([c("10"), c("9")], c("6"), "stand");
    expect(why).toMatch(/19/);
  });

  it("explains hitting: free card under 12, forced draw on a stiff", () => {
    expect(explainAction([c("5"), c("4")], c("K"), "hit")).toMatch(/can't bust/i);
    expect(explainAction([c("10"), c("6")], c("K"), "hit")).toMatch(/dealer/i);
  });

  it("has dedicated stories for aces and eights", () => {
    expect(explainAction([c("A", "C"), c("A", "H")], c("5"), "split")).toMatch(/aces/i);
    expect(explainAction([c("8", "C"), c("8", "H")], c("K"), "split")).toMatch(/worst/i);
  });

  it("explains doubles, surrender, and never-take-insurance", () => {
    expect(explainAction([c("6"), c("5")], c("6"), "double")).toContain("11");
    expect(explainAction([c("A"), c("7")], c("5"), "double")).toMatch(/soft/i);
    expect(explainAction([c("K"), c("6")], c("A"), "surrender")).toMatch(/half/i);
    expect(explainAction([c("10"), c("9")], c("A"), "insurance-no")).toMatch(/insurance/i);
    expect(explainAction([c("A"), c("K")], c("A"), "even-money-no")).toMatch(/3:2/);
  });

  it("withHint attaches both the hint and its reason to the client view", () => {
    // Rig: player 10♦+6♦ vs dealer 6 up — basic strategy stands
    const filler: Card[] = Array.from({ length: 100 }, () => c("2", "D"));
    const shoe = [...filler, ...[c("10", "D"), c("6", "C"), c("6", "D"), c("9", "H")].reverse()];
    const { state } = startRound(10, { previousShoe: shoe });
    const view = withHint(state, clientView(state));
    expect(view.hint).toBe("stand");
    expect(view.hintReason).toMatch(/bust/i);
  });
});

// ── Pro book: Illustrious 18 count deviations (#9, opt-in) ─────────────────

describe("recommendAction with the pro book", () => {
  const card = (rank: Card["rank"]): Card => ({ rank, suit: "S" } as Card);
  const ALL: PlayerAction[] = ["hit", "stand", "double", "split", "surrender"];

  // The most important property: existing players see no change at all.
  it("is OFF by default — basic strategy is unchanged", () => {
    const sixteen = [card("10"), card("6")];
    expect(recommendAction(sixteen, card("K"), ALL)).toBe("hit");
    expect(recommendAction(sixteen, card("K"), ALL, "classic")).toBe("hit");
    expect(
      recommendAction(sixteen, card("K"), ALL, "classic", { enabled: false, trueCount: 9 })
    ).toBe("hit");
  });

  it("stands 16 vs 10 once enabled and the count is at the index", () => {
    const sixteen = [card("10"), card("6")];
    expect(
      recommendAction(sixteen, card("K"), ALL, "classic", { enabled: true, trueCount: -1 })
    ).toBe("hit");
    expect(
      recommendAction(sixteen, card("K"), ALL, "classic", { enabled: true, trueCount: 0 })
    ).toBe("stand");
  });

  it("doubles 11 vs ace from +1", () => {
    const eleven = [card("6"), card("5")];
    expect(
      recommendAction(eleven, card("A"), ALL, "classic", { enabled: true, trueCount: 1 })
    ).toBe("double");
  });

  it("reverses on a ten-poor shoe (13 vs 2 becomes a hit)", () => {
    const thirteen = [card("9"), card("4")];
    expect(
      recommendAction(thirteen, card("2"), ALL, "classic", { enabled: true, trueCount: 0 })
    ).toBe("stand");
    expect(
      recommendAction(thirteen, card("2"), ALL, "classic", { enabled: true, trueCount: -1 })
    ).toBe("hit");
  });

  it("takes insurance only at a genuinely ten-rich shoe", () => {
    const hand = [card("9"), card("7")];
    const ins: PlayerAction[] = ["insurance-yes", "insurance-no"];
    expect(recommendAction(hand, card("A"), ins, "classic")).toBe("insurance-no");
    expect(
      recommendAction(hand, card("A"), ins, "classic", { enabled: true, trueCount: 2 })
    ).toBe("insurance-no");
    expect(
      recommendAction(hand, card("A"), ins, "classic", { enabled: true, trueCount: 3 })
    ).toBe("insurance-yes");
  });

  it("still declines even money regardless of the count", () => {
    // Even money is insurance on a natural — the 3:2 payout still wins out.
    const nat = [card("A"), card("K")];
    expect(
      recommendAction(nat, card("A"), ["even-money-yes", "even-money-no"], "classic", {
        enabled: true,
        trueCount: 9,
      })
    ).toBe("even-money-no");
  });

  // The published indices assume a 6-deck shoe that HAS tens in it.
  it("ignores the count on Spanish 21, where the indices don't apply", () => {
    const sixteen = [card("10"), card("6")];
    expect(
      recommendAction(sixteen, card("K"), ALL, "spanish21", { enabled: true, trueCount: 9 })
    ).toBe("hit");
  });

  it("never returns an action the table doesn't allow", () => {
    const eleven = [card("6"), card("5")];
    const out = recommendAction(eleven, card("A"), ["hit", "stand"], "classic", {
      enabled: true,
      trueCount: 9,
    });
    expect(["hit", "stand"]).toContain(out);
  });
});

// ── proBookActive: the single variant-gating rule (#9) ──────────────────────
//
// Shared by withHint's on-screen hint and action/route.ts's ProBookStat
// grading gate — one function, tested once, so the two call sites can never
// silently disagree about when the pro book is actually live.

describe("proBookActive", () => {
  it("requires both opt-in AND the classic table", () => {
    expect(proBookActive("classic", true)).toBe(true);
    expect(proBookActive("classic", false)).toBe(false);
    expect(proBookActive("spanish21", true)).toBe(false);
    expect(proBookActive("spanish21", false)).toBe(false);
  });
});

// ── withHint + the pro-book toggle: the actual wiring (#9) ──────────────────
//
// This is the integration point the whole feature hangs off: Strategy
// Masters' grading in action/route.ts calls withHint WITHOUT `proBook`, so
// its meaning must never shift. These tests rig a hand/count where basic
// strategy and the Illustrious 18 disagree and prove the split holds.

describe("withHint with the pro book", () => {
  // Rig a hand/count where basic and pro strategy diverge: hard 16 vs a
  // dealer 10-upcard is Illustrious 18 #2 (index 0, "at-or-above") — basic
  // strategy hits, the pro book stands once true count >= 0. A large neutral
  // ("8", Hi-Lo 0) filler plus a seeded previousCount puts the true count at
  // a comfortable +4.5 after the opening deal, well clear of the threshold.
  function riggedSixteenVsTen() {
    const filler: Card[] = Array.from({ length: 104 }, () => c("8", "S"));
    const shoe = [...filler, ...[c("10", "D"), c("K", "C"), c("6", "D"), c("9", "H")].reverse()];
    return startRound(10, { previousShoe: shoe, previousCount: 10 }).state;
  }

  it("is OFF by default — the on-screen hint stays basic strategy at a rich count", () => {
    const state = riggedSixteenVsTen();
    const view = withHint(state, clientView(state));
    expect(view.hint).toBe("hit");
    expect(view.hintReason).not.toMatch(/count/i);
  });

  it("passing proBook=false is identical to omitting it (Strategy Masters' exact call shape)", () => {
    const state = riggedSixteenVsTen();
    const withFlag = withHint(state, clientView(state), false);
    const withoutFlag = withHint(state, clientView(state));
    expect(withFlag.hint).toBe(withoutFlag.hint);
    expect(withFlag.hint).toBe("hit");
  });

  it("proBook=true deviates from basic strategy and explains the count, not the book", () => {
    const state = riggedSixteenVsTen();
    const view = withHint(state, clientView(state), true);
    expect(view.trueCount).toBeGreaterThanOrEqual(4); // sanity: the rig landed where intended
    expect(view.hint).toBe("stand");
    expect(view.hintReason).toMatch(/count/i);
    expect(view.hintReason).toMatch(/\+?4\.5|true count/i);
  });

  it("proBook=true is a no-op on Spanish 21 even at the same rich count", () => {
    const filler: Card[] = Array.from({ length: 104 }, () => c("8", "S"));
    const shoe = [...filler, ...[c("10", "D"), c("K", "C"), c("6", "D"), c("9", "H")].reverse()];
    const { state } = startRound(10, {
      previousShoe: shoe,
      previousCount: 10,
      previousVariant: "spanish21",
      variant: "spanish21",
    });
    const view = withHint(state, clientView(state), true);
    // Spanish 21's hard-total table hits 16 vs 10 regardless of the count.
    expect(view.hint).toBe("hit");
    expect(view.hintReason).not.toMatch(/count/i);
  });

  it("grading call shape (no proBook arg) never changes regardless of a caller elsewhere passing true", () => {
    // Simulates the actual conflict the issue describes: the SAME state is
    // hinted for on-screen display with proBook on, and separately graded
    // for Strategy Masters without it — the two must not contaminate each other.
    const state = riggedSixteenVsTen();
    const onScreen = withHint(state, clientView(state), true);
    const graded = withHint(state, clientView(state)); // Strategy Masters' exact call
    expect(onScreen.hint).toBe("stand"); // pro book fired
    expect(graded.hint).toBe("hit"); // basic strategy, untouched
  });
});
