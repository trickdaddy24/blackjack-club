import { describe, it, expect } from "vitest";
import {
  applyAction,
  blackjackPayout,
  canSplit,
  cardValue,
  clientView,
  createShoe,
  handValue,
  hiLo,
  IllegalActionError,
  insuranceCost,
  netResult,
  RESHUFFLE_AT,
  rulesFor,
  SHOE_SIZE,
  startRound,
  stateInsuranceCost,
  type Card,
  type Rank,
  type RoundState,
  type Suit,
} from "./engine";

function c(rank: Rank, suit: Suit = "C"): Card {
  return { rank, suit };
}

/**
 * Build a shoe that deals the given cards in order. `startRound` draws
 * player, dealer-up, player, dealer-hole, then any later draws continue
 * in sequence. Padded so the shoe passes the reshuffle threshold.
 */
function shoeFor(...dealOrder: Card[]): Card[] {
  const filler: Card[] = Array.from({ length: 100 }, () => c("2", "D"));
  return [...filler, ...[...dealOrder].reverse()];
}

describe("handValue", () => {
  it("counts soft aces as 11", () => {
    expect(handValue([c("A"), c("6")])).toEqual({ total: 17, soft: true });
  });

  it("demotes aces to 1 to avoid busting", () => {
    expect(handValue([c("A"), c("6"), c("10")])).toEqual({ total: 17, soft: false });
  });

  it("handles multiple aces", () => {
    expect(handValue([c("A"), c("A")])).toEqual({ total: 12, soft: true });
    expect(handValue([c("A"), c("A"), c("9")])).toEqual({ total: 21, soft: true });
    expect(handValue([c("A"), c("A"), c("A"), c("K")])).toEqual({ total: 13, soft: false });
  });

  it("values face cards at 10", () => {
    expect(cardValue(c("J"))).toBe(10);
    expect(cardValue(c("Q"))).toBe(10);
    expect(cardValue(c("K"))).toBe(10);
    expect(handValue([c("K"), c("Q")]).total).toBe(20);
  });
});

describe("startRound", () => {
  it("debits the bet and deals 2+2", () => {
    const { state, debit } = startRound(10, shoeFor(c("5"), c("9"), c("6"), c("7")));
    expect(debit).toBe(10);
    expect(state.hands[0].cards).toEqual([c("5"), c("6")]);
    expect(state.dealer).toEqual([c("9"), c("7")]);
    expect(state.phase).toBe("player");
    expect(state.staked).toBe(10);
  });

  it("rejects invalid bets", () => {
    expect(() => startRound(0)).toThrow(IllegalActionError);
    expect(() => startRound(-5)).toThrow(IllegalActionError);
    expect(() => startRound(2.5)).toThrow(IllegalActionError);
  });

  it("pays player blackjack 3:2 immediately", () => {
    const { state } = startRound(10, shoeFor(c("A"), c("5"), c("K"), c("9")));
    expect(state.phase).toBe("settled");
    expect(state.hands[0].outcome).toBe("blackjack");
    expect(state.hands[0].payout).toBe(25);
    expect(netResult(state)).toBe(15);
  });

  it("peeks on a ten upcard and ends the round on dealer blackjack", () => {
    const { state } = startRound(10, shoeFor(c("9"), c("K"), c("8"), c("A")));
    expect(state.phase).toBe("settled");
    expect(state.hands[0].outcome).toBe("lose");
    expect(netResult(state)).toBe(-10);
  });

  it("pushes player blackjack against dealer blackjack (ten up)", () => {
    const { state } = startRound(10, shoeFor(c("A"), c("K"), c("Q"), c("A")));
    expect(state.phase).toBe("settled");
    expect(state.hands[0].outcome).toBe("push");
    expect(netResult(state)).toBe(0);
  });

  it("offers insurance on a dealer ace", () => {
    const { state } = startRound(10, shoeFor(c("9"), c("A"), c("8"), c("K")));
    expect(state.phase).toBe("insurance");
    expect(state.insuranceBet).toBeNull();
  });

  it("reuses a healthy shoe and reshuffles a depleted one", () => {
    const healthy = shoeFor(c("5"), c("9"), c("6"), c("7"));
    const reused = startRound(10, healthy).state;
    expect(reused.shoe.length).toBe(healthy.length - 4);

    const depleted = healthy.slice(0, RESHUFFLE_AT - 1);
    const fresh = startRound(10, depleted).state;
    expect(fresh.shoe.length).toBe(SHOE_SIZE - 4);
  });
});

describe("insurance", () => {
  const insuranceStart = (dealOrder: Card[]) => startRound(10, shoeFor(...dealOrder)).state;

  it("costs half the base bet and pays 2:1 on dealer blackjack", () => {
    const state = insuranceStart([c("9"), c("A"), c("8"), c("K")]);
    const { state: settled, debit } = applyAction(state, "insurance-yes");
    expect(debit).toBe(5);
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].outcome).toBe("lose");
    // Lost 10 on the hand, staked 5 insurance returned as 15 → net -10 + 10 = 0
    expect(settled.payoutTotal).toBe(15);
    expect(netResult(settled)).toBe(0);
  });

  it("loses the insurance bet when the dealer has no blackjack", () => {
    const state = insuranceStart([c("9"), c("A"), c("8"), c("7")]);
    const { state: after, debit } = applyAction(state, "insurance-yes");
    expect(debit).toBe(5);
    expect(after.phase).toBe("player");
    expect(after.staked).toBe(15);
  });

  it("declining insurance costs nothing", () => {
    const state = insuranceStart([c("9"), c("A"), c("8"), c("7")]);
    const { state: after, debit } = applyAction(state, "insurance-no");
    expect(debit).toBe(0);
    expect(after.phase).toBe("player");
    expect(after.staked).toBe(10);
  });

  it("settles a player blackjack 3:2 after the insurance decision", () => {
    const state = insuranceStart([c("A"), c("A"), c("K"), c("7")]);
    const { state: settled } = applyAction(state, "insurance-no");
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].outcome).toBe("blackjack");
    expect(netResult(settled)).toBe(15);
  });

  it("rejects game actions while insurance is pending", () => {
    const state = insuranceStart([c("9"), c("A"), c("8"), c("K")]);
    expect(() => applyAction(state, "hit")).toThrow(IllegalActionError);
  });

  it("rejects insurance when not offered", () => {
    const { state } = startRound(10, shoeFor(c("5"), c("9"), c("6"), c("7")));
    expect(() => applyAction(state, "insurance-yes")).toThrow(IllegalActionError);
  });
});

describe("dealer play", () => {
  it("stands on soft 17", () => {
    // Player 20 stands; dealer 6 + A = soft 17 must not draw
    const { state } = startRound(10, shoeFor(c("10"), c("6"), c("10"), c("A")));
    const { state: settled } = applyAction(state, "stand");
    expect(settled.dealer.length).toBe(2);
    expect(handValue(settled.dealer)).toEqual({ total: 17, soft: true });
    expect(settled.hands[0].outcome).toBe("win");
    expect(settled.hands[0].payout).toBe(20);
  });

  it("draws to 17 and can bust", () => {
    // Dealer 6 + 8 = 14, draws K → 24 bust
    const { state } = startRound(10, shoeFor(c("10"), c("6"), c("9"), c("8"), c("K")));
    const { state: settled } = applyAction(state, "stand");
    expect(handValue(settled.dealer).total).toBe(24);
    expect(settled.hands[0].outcome).toBe("win");
  });

  it("does not draw when every player hand busted", () => {
    // Player 10+9, hits K → 29 bust; dealer 6+8 stays at 2 cards
    const { state } = startRound(10, shoeFor(c("10"), c("6"), c("9"), c("8"), c("K")));
    const { state: settled } = applyAction(state, "hit");
    expect(settled.phase).toBe("settled");
    expect(settled.dealer.length).toBe(2);
    expect(settled.hands[0].outcome).toBe("lose");
    expect(netResult(settled)).toBe(-10);
  });

  it("pushes equal totals", () => {
    const { state } = startRound(10, shoeFor(c("10"), c("K"), c("9"), c("9")));
    const { state: settled } = applyAction(state, "stand");
    expect(settled.hands[0].outcome).toBe("push");
    expect(netResult(settled)).toBe(0);
  });
});

describe("hit / stand / double", () => {
  it("hit draws a card and auto-stands on 21", () => {
    const { state } = startRound(10, shoeFor(c("10"), c("6"), c("9"), c("8"), c("2"), c("7")));
    const one = applyAction(state, "hit").state; // 10+9+2 = 21 → done
    expect(one.hands[0].done).toBe(true);
    expect(one.phase).toBe("settled"); // single hand done → dealer plays out
  });

  it("double doubles the bet, draws exactly one card, and finishes the hand", () => {
    // Player 6+5=11 doubles, draws K → 21; dealer 9+8=17 stands
    const { state } = startRound(10, shoeFor(c("6"), c("9"), c("5"), c("8"), c("K")));
    const { state: settled, debit } = applyAction(state, "double");
    expect(debit).toBe(10);
    expect(settled.hands[0].bet).toBe(20);
    expect(settled.hands[0].cards.length).toBe(3);
    expect(settled.hands[0].outcome).toBe("win");
    expect(settled.hands[0].payout).toBe(40);
    expect(netResult(settled)).toBe(20);
  });

  it("rejects double after hitting", () => {
    const { state } = startRound(10, shoeFor(c("2", "S"), c("9"), c("3"), c("8"), c("2", "H")));
    const after = applyAction(state, "hit").state;
    expect(after.phase).toBe("player");
    expect(() => applyAction(after, "double")).toThrow(IllegalActionError);
  });

  it("rejects any action on a settled round", () => {
    const { state } = startRound(10, shoeFor(c("A"), c("5"), c("K"), c("9")));
    expect(state.phase).toBe("settled");
    expect(() => applyAction(state, "hit")).toThrow(IllegalActionError);
    expect(() => applyAction(state, "stand")).toThrow(IllegalActionError);
  });
});

describe("split", () => {
  it("requires equal ranks", () => {
    const { state } = startRound(10, shoeFor(c("10"), c("9"), c("K"), c("8")));
    expect(canSplit(state, 0)).toBe(false);
    expect(() => applyAction(state, "split")).toThrow(IllegalActionError);
  });

  it("splits into two hands, debiting a second bet", () => {
    // 8,8 vs dealer 7; hands draw 2 (→10) and 3 (→11)
    const { state } = startRound(10, shoeFor(c("8", "S"), c("7"), c("8", "H"), c("9"), c("2"), c("3")));
    const { state: after, debit } = applyAction(state, "split");
    expect(debit).toBe(10);
    expect(after.hands.length).toBe(2);
    expect(after.hands[0].cards).toEqual([c("8", "S"), c("2")]);
    expect(after.hands[1].cards).toEqual([c("8", "H"), c("3")]);
    expect(after.hands.every((h) => h.fromSplit)).toBe(true);
    expect(after.staked).toBe(20);
    expect(after.active).toBe(0);
  });

  it("plays hands in order and settles both", () => {
    // Split 8s vs dealer 9+9=18. Hand 1: 8+2, hit 10 → 20. Hand 2: 8+3, hit 5 → 16, stand.
    const { state } = startRound(
      10,
      shoeFor(c("8", "S"), c("9", "S"), c("8", "H"), c("9", "H"), c("2"), c("3"), c("10"), c("5"))
    );
    let s = applyAction(state, "split").state;
    s = applyAction(s, "hit").state; // hand 0: 20
    s = applyAction(s, "stand").state; // hand 0 done → active = 1
    expect(s.active).toBe(1);
    s = applyAction(s, "hit").state; // hand 1: 16
    const settled = applyAction(s, "stand").state;
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].outcome).toBe("win"); // 20 > 18
    expect(settled.hands[1].outcome).toBe("lose"); // 16 < 18
    expect(netResult(settled)).toBe(0);
  });

  it("split aces get exactly one card each and cannot be hit", () => {
    // A,A vs dealer 20; draws K and 9 → 21 and 20
    const { state } = startRound(
      10,
      shoeFor(c("A", "S"), c("K", "S"), c("A", "H"), c("Q"), c("K", "H"), c("9"))
    );
    const { state: settled } = applyAction(state, "split");
    // Both hands auto-complete → round settles
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].cards.length).toBe(2);
    expect(settled.hands[1].cards.length).toBe(2);
    // 21 after split is NOT blackjack — wins 1:1 vs dealer 20
    expect(settled.hands[0].outcome).toBe("win");
    expect(settled.hands[0].payout).toBe(20);
    expect(settled.hands[1].outcome).toBe("push");
  });

  it("allows one re-split (max 3 hands) and doubling after split", () => {
    // 8,8 vs dealer 7+K=17. Split → hand0 draws 8 (re-splittable), hand1 draws 3.
    // Re-split hand0 → draws 2 (→10) and 5 (→13).
    const { state } = startRound(
      10,
      shoeFor(c("8", "S"), c("7"), c("8", "H"), c("K"), c("8", "D"), c("3"), c("2"), c("5"), c("9"), c("10"), c("6"))
    );
    let s = applyAction(state, "split").state;
    expect(canSplit(s, 0)).toBe(true);
    s = applyAction(s, "split").state;
    expect(s.hands.length).toBe(3);
    expect(s.splits).toBe(2);
    expect(s.staked).toBe(30);
    // No third re-split even with another pair
    expect(canSplit(s, 0)).toBe(false);

    // Double after split: hand 0 is 8+2=10, doubles and draws 9 → 19
    const dbl = applyAction(s, "double");
    expect(dbl.debit).toBe(10);
    expect(dbl.state.hands[0].bet).toBe(20);
    expect(dbl.state.hands[0].outcome).toBeNull(); // not settled yet
    expect(dbl.state.staked).toBe(40);
  });
});

describe("multi-seat (two hands at once)", () => {
  // Deal order for 2 seats: seat1, seat2, dealer up, seat1, seat2, dealer hole
  it("deals two hands casino-style and debits both bets", () => {
    const { state, debit } = startRound(
      10,
      shoeFor(c("5"), c("7"), c("9"), c("6"), c("8"), c("2")),
      undefined,
      2
    );
    expect(debit).toBe(20);
    expect(state.staked).toBe(20);
    expect(state.hands.length).toBe(2);
    expect(state.hands[0].cards).toEqual([c("5"), c("6")]);
    expect(state.hands[1].cards).toEqual([c("7"), c("8")]);
    expect(state.dealer).toEqual([c("9"), c("2")]);
    expect(state.phase).toBe("player");
    expect(state.active).toBe(0);
  });

  it("rejects invalid seat counts", () => {
    expect(() => startRound(10, undefined, undefined, 0)).toThrow(IllegalActionError);
    expect(() => startRound(10, undefined, undefined, 3)).toThrow(IllegalActionError);
  });

  it("plays seats left to right and settles each independently", () => {
    // h0 = 11, h1 = 15, dealer 9+2=11 draws K → 21: both lose
    const { state } = startRound(
      10,
      shoeFor(c("5"), c("7"), c("9"), c("6"), c("8"), c("2"), c("K")),
      undefined,
      2
    );
    const afterFirst = applyAction(state, "stand").state;
    expect(afterFirst.active).toBe(1);
    const settled = applyAction(afterFirst, "stand").state;
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].outcome).toBe("lose");
    expect(settled.hands[1].outcome).toBe("lose");
    expect(netResult(settled)).toBe(-20);
  });

  it("locks a natural on one seat while the other still plays", () => {
    // h0 = A+K natural, h1 = 5+5 = 10, dealer 9+7=16 draws 4 → 20
    const { state } = startRound(
      10,
      shoeFor(c("A"), c("5", "S"), c("9"), c("K"), c("5", "H"), c("7"), c("4")),
      undefined,
      2
    );
    expect(state.phase).toBe("player");
    expect(state.hands[0].done).toBe(true);
    expect(state.active).toBe(1); // natural is skipped
    const settled = applyAction(state, "stand").state;
    expect(settled.hands[0].outcome).toBe("blackjack");
    expect(settled.hands[0].payout).toBe(25);
    expect(settled.hands[1].outcome).toBe("lose");
    expect(netResult(settled)).toBe(5);
  });

  it("insurance covers both seats and still nets zero on dealer blackjack", () => {
    const { state } = startRound(
      10,
      shoeFor(c("9"), c("8"), c("A"), c("7"), c("6"), c("K")),
      undefined,
      2
    );
    expect(state.phase).toBe("insurance");
    expect(clientView(state).insuranceCost).toBe(10); // 5 per seat
    const { state: settled, debit } = applyAction(state, "insurance-yes");
    expect(debit).toBe(10);
    expect(settled.phase).toBe("settled");
    expect(settled.payoutTotal).toBe(30); // insurance pays 2:1
    expect(netResult(settled)).toBe(0);
  });
});

describe("clientView", () => {
  it("hides the hole card and shoe until reveal", () => {
    const { state } = startRound(10, shoeFor(c("5"), c("9"), c("6"), c("7")));
    const view = clientView(state);
    expect(view.dealer.cards).toEqual([c("9"), null]);
    expect(view.dealer.total).toBe(9);
    expect(view.dealer.revealed).toBe(false);
    expect(JSON.stringify(view)).not.toContain('"shoe"');
    expect(view.actions).toContain("hit");
    expect(view.actions).toContain("stand");
    expect(view.actions).toContain("double");
    expect(view.actions).not.toContain("split");
  });

  it("reveals the dealer hand once settled", () => {
    const { state } = startRound(10, shoeFor(c("10"), c("K"), c("9"), c("9")));
    const settled = applyAction(state, "stand").state;
    const view = clientView(settled);
    expect(view.dealer.cards).toEqual([c("K"), c("9")]);
    expect(view.dealer.total).toBe(19);
    expect(view.actions).toEqual([]);
    expect(view.netResult).toBe(0);
  });

  it("offers insurance actions during the insurance phase", () => {
    const { state } = startRound(10, shoeFor(c("9"), c("A"), c("8"), c("K")));
    const view = clientView(state);
    expect(view.actions).toEqual(["insurance-yes", "insurance-no"]);
    expect(view.insuranceCost).toBe(5);
    expect(view.dealer.cards[1]).toBeNull();
  });
});

describe("shoe", () => {
  it("contains 312 unique-position cards with correct composition", () => {
    const shoe = createShoe();
    expect(shoe.length).toBe(SHOE_SIZE);
    const aces = shoe.filter((card) => card.rank === "A").length;
    expect(aces).toBe(24); // 6 decks × 4 suits
  });

  it("blackjackPayout and insuranceCost round down", () => {
    expect(blackjackPayout(10)).toBe(25);
    expect(blackjackPayout(5)).toBe(12); // 5 + floor(7.5)
    expect(insuranceCost(25)).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// v0.4.0 — Spanish 21, Hi-Lo count, bots, shuffled flag, compat
// ---------------------------------------------------------------------------

/** Options-form startRound on a rigged Spanish shoe. */
function spanish(bet: number, shoe: Card[], extra: Partial<Parameters<typeof startRound>[1] & object> = {}) {
  return startRound(bet, {
    previousShoe: shoe,
    previousVariant: "spanish21",
    variant: "spanish21",
    ...extra,
  });
}

describe("spanish 21 shoe", () => {
  it("builds 288-card shoes with no 10s but all faces", () => {
    const shoe = createShoe(undefined, rulesFor("spanish21"));
    expect(shoe.length).toBe(288);
    expect(shoe.filter((card) => card.rank === "10")).toHaveLength(0);
    expect(shoe.filter((card) => card.rank === "J")).toHaveLength(24);
    expect(shoe.filter((card) => card.rank === "A")).toHaveLength(24);
  });

  it("reshuffles at 72 cards (25% of 288), not 78", () => {
    const low = Array.from({ length: 71 }, () => c("2", "D"));
    const ok = Array.from({ length: 72 }, () => c("2", "D"));
    expect(spanish(10, low).shuffled).toBe(true);
    expect(spanish(10, ok).shuffled).toBe(false);
  });

  it("variant mismatch forces a reshuffle", () => {
    const classicShoe = shoeFor(c("5"), c("9"), c("6"), c("7"));
    const r = startRound(10, {
      previousShoe: classicShoe,
      previousVariant: "classic",
      variant: "spanish21",
    });
    expect(r.shuffled).toBe(true);
    // Fresh spanish shoe: 288 minus the 4 dealt cards
    expect(r.state.shoe.length).toBe(284);
  });
});

describe("spanish 21 payouts", () => {
  it("pays 5-card 21 at 3:2", () => {
    let r = spanish(10, shoeFor(c("2"), c("9"), c("3"), c("7"), c("4"), c("5"), c("7")));
    r = applyAction(r.state, "hit"); // 9
    r = applyAction(r.state, "hit"); // 14
    r = applyAction(r.state, "hit"); // 21 → auto-done → settles
    expect(r.state.phase).toBe("settled");
    expect(r.state.hands[0].outcome).toBe("win");
    expect(r.state.hands[0].payout).toBe(25);
    expect(r.state.hands[0].bonus).toBe("5-Card 21");
  });

  it("pays 6-card 21 at 2:1 and 7-card 21 at 3:1", () => {
    let r = spanish(10, shoeFor(c("2"), c("9"), c("2"), c("8"), c("3"), c("4"), c("4"), c("6")));
    for (let i = 0; i < 4; i++) r = applyAction(r.state, "hit"); // 2+2+3+4+4+6 = 21
    expect(r.state.hands[0].payout).toBe(30);
    expect(r.state.hands[0].bonus).toBe("6-Card 21");

    let r7 = spanish(10, shoeFor(c("2"), c("9"), c("2"), c("8"), c("2"), c("3"), c("3"), c("4"), c("5")));
    for (let i = 0; i < 5; i++) r7 = applyAction(r7.state, "hit"); // 2+2+2+3+3+4+5 = 21
    expect(r7.state.hands[0].payout).toBe(40);
    expect(r7.state.hands[0].bonus).toBe("7-Card 21");
  });

  it("pays 6-7-8 by suit tier", () => {
    const run = (suits: [Suit, Suit, Suit]) => {
      let r = spanish(10, shoeFor(c("6", suits[0]), c("9"), c("7", suits[1]), c("8", "H"), c("8", suits[2])));
      r = applyAction(r.state, "hit"); // 6+7+8 = 21
      return r.state.hands[0];
    };
    expect(run(["H", "C", "D"])).toMatchObject({ payout: 25, bonus: "6-7-8" });
    expect(run(["H", "H", "H"])).toMatchObject({ payout: 30, bonus: "6-7-8 Suited" });
    expect(run(["S", "S", "S"])).toMatchObject({ payout: 40, bonus: "6-7-8 Spades" });
  });

  it("pays 7-7-7 spades at 3:1", () => {
    let r = spanish(10, shoeFor(c("7", "S"), c("9"), c("7", "S"), c("8", "H"), c("7", "S")));
    r = applyAction(r.state, "hit");
    expect(r.state.hands[0].payout).toBe(40);
    expect(r.state.hands[0].bonus).toBe("7-7-7 Spades");
  });

  it("voids the bonus on a doubled 21", () => {
    let r = spanish(10, shoeFor(c("5"), c("9"), c("6"), c("K"), c("K")));
    r = applyAction(r.state, "double"); // 5+6+K = 21 doubled
    expect(r.state.phase).toBe("settled");
    expect(r.state.hands[0].bonus).toBeUndefined();
    expect(r.state.hands[0].payout).toBe(40); // even money on the doubled 20 bet
  });

  it("player multi-card 21 beats dealer 21", () => {
    let r = spanish(10, shoeFor(c("9"), c("7"), c("8"), c("7"), c("4"), c("7")));
    r = applyAction(r.state, "hit"); // 9+8+4 = 21; dealer 7+7 draws 7 → 21
    expect(handValue(r.state.dealer).total).toBe(21);
    expect(r.state.hands[0].outcome).toBe("win");
    expect(r.state.hands[0].payout).toBe(20);
  });

  it("player blackjack beats dealer blackjack (classic pushes)", () => {
    const shoe = () => shoeFor(c("A"), c("K"), c("K", "H"), c("A", "H"));
    const sp = spanish(10, shoe());
    expect(sp.state.hands[0].outcome).toBe("blackjack");
    expect(netResult(sp.state)).toBe(15);

    const cl = startRound(10, { previousShoe: shoe(), variant: "classic" });
    expect(cl.state.hands[0].outcome).toBe("push");
    expect(netResult(cl.state)).toBe(0);
  });
});

describe("spanish 21 surrender", () => {
  it("returns half the bet and settles", () => {
    const r0 = spanish(10, shoeFor(c("9"), c("9"), c("7"), c("K")));
    const r = applyAction(r0.state, "surrender");
    expect(r.state.phase).toBe("settled");
    expect(r.state.hands[0].outcome).toBe("surrender");
    expect(r.state.hands[0].payout).toBe(5);
    expect(netResult(r.state)).toBe(-5);
    expect(r.state.dealerRevealed).toBe(true);
    expect(r.state.dealer).toHaveLength(2); // nobody live — dealer doesn't draw
  });

  it("is illegal after a hit and in classic", () => {
    const sp = spanish(10, shoeFor(c("2"), c("9"), c("3"), c("K"), c("4")));
    const hit = applyAction(sp.state, "hit");
    expect(() => applyAction(hit.state, "surrender")).toThrow(IllegalActionError);

    const cl = startRound(10, shoeFor(c("9"), c("9"), c("7"), c("K")));
    expect(() => applyAction(cl.state, "surrender")).toThrow(IllegalActionError);
  });

  it("appears in clientView actions only for spanish", () => {
    const sp = spanish(10, shoeFor(c("9"), c("9"), c("7"), c("K")));
    expect(clientView(sp.state).actions).toContain("surrender");
    const cl = startRound(10, shoeFor(c("9"), c("9"), c("7"), c("K")));
    expect(clientView(cl.state).actions).not.toContain("surrender");
  });
});

describe("hi-lo count", () => {
  it("values cards correctly", () => {
    expect(hiLo(c("2"))).toBe(1);
    expect(hiLo(c("6"))).toBe(1);
    expect(hiLo(c("7"))).toBe(0);
    expect(hiLo(c("9"))).toBe(0);
    expect(hiLo(c("10"))).toBe(-1);
    expect(hiLo(c("K"))).toBe(-1);
    expect(hiLo(c("A"))).toBe(-1);
  });

  it("counts the opening deal without the hole card", () => {
    const { state } = startRound(10, { previousShoe: shoeFor(c("2"), c("9"), c("5"), c("K")) });
    // 2 (+1), 9 (0), 5 (+1); hole K uncounted
    expect(state.runningCount).toBe(2);
  });

  it("counts the hole card once at reveal plus dealer draws", () => {
    const r0 = startRound(10, { previousShoe: shoeFor(c("2"), c("9"), c("5"), c("2", "H")) });
    const r = applyAction(r0.state, "stand");
    // deal +2, hole 2 (+1), dealer 11 → draws three filler 2s (+3) to 17
    expect(handValue(r.state.dealer).total).toBe(17);
    expect(r.state.runningCount).toBe(6);
  });

  it("does not count the hole card on an insurance peek without blackjack", () => {
    const r0 = startRound(10, { previousShoe: shoeFor(c("5"), c("A"), c("6"), c("5", "H")) });
    expect(r0.state.phase).toBe("insurance");
    const r = applyAction(r0.state, "insurance-no");
    // 5 (+1), A (−1), 6 (+1); hole 5 still hidden
    expect(r.state.runningCount).toBe(1);
    expect(r.state.dealerRevealed).toBe(false);
  });

  it("carries previousCount with the shoe and resets on a fresh shoe", () => {
    const carried = startRound(10, {
      previousShoe: shoeFor(c("2"), c("9"), c("5"), c("K")),
      previousCount: 5,
    });
    expect(carried.state.runningCount).toBe(7); // 5 + 2 from the deal

    const fresh = startRound(10, { previousCount: 5 });
    expect(fresh.shuffled).toBe(true);
    // fresh shoe resets to 0 before the deal; deal is random so just bound it
    expect(Math.abs(fresh.state.runningCount)).toBeLessThanOrEqual(3);
  });

  it("computes decksRemaining and trueCount in clientView", () => {
    const state: RoundState = {
      shoe: Array.from({ length: 208 }, () => c("2", "D")),
      dealer: [c("9"), c("K")],
      dealerRevealed: false,
      hands: [
        { cards: [c("5"), c("6")], bet: 10, doubled: false, done: false, fromSplit: false, splitAces: false, outcome: null, payout: 0 },
      ],
      active: 0,
      phase: "player",
      baseBet: 10,
      insuranceBet: 0,
      splits: 0,
      staked: 10,
      payoutTotal: 0,
      variant: "classic",
      runningCount: 8,
      bots: [],
    };
    const view = clientView(state);
    expect(view.decksRemaining).toBe(4);
    expect(view.trueCount).toBe(2);
    expect(view.runningCount).toBe(8);
  });

  it("includes bot cards in the count", () => {
    const { state } = startRound(10, {
      previousShoe: shoeFor(c("2"), c("3"), c("9"), c("4"), c("5"), c("K")),
      bots: 1,
    });
    // P 2 (+1), bot 3 (+1), up 9 (0), P 4 (+1), bot 5 (+1); hole K uncounted
    expect(state.runningCount).toBe(4);
  });
});

describe("bots", () => {
  it("deals in casino order: player, bots, dealer up, second round, hole", () => {
    const { state } = startRound(10, {
      previousShoe: shoeFor(c("2"), c("3"), c("9"), c("4"), c("5"), c("K")),
      bots: 1,
    });
    expect(state.hands[0].cards).toEqual([c("2"), c("4")]);
    expect(state.bots[0].cards).toEqual([c("3"), c("5")]);
    expect(state.dealer).toEqual([c("9"), c("K")]);
    expect(state.bots[0].name).toBe("Vinny");
  });

  it("stands on hard 12 vs dealer 5, hits vs 7", () => {
    const vs5 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("8"), c("5"), c("K", "H"), c("4"), c("K", "D")),
      bots: 1,
    });
    const settled5 = applyAction(vs5.state, "stand").state;
    expect(settled5.bots[0].cards).toHaveLength(2); // 12 vs 5 stands

    const vs7 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("8"), c("7"), c("K", "H"), c("4"), c("K", "D")),
      bots: 1,
    });
    const settled7 = applyAction(vs7.state, "stand").state;
    // 12 → 14 → 16 → 18 on filler 2s
    expect(settled7.bots[0].cards).toHaveLength(5);
    expect(handValue(settled7.bots[0].cards).total).toBe(18);
  });

  it("doubles hard 11 vs dealer 9: one card, doubled bet", () => {
    const r0 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("6"), c("9"), c("9", "H"), c("5"), c("K", "D")),
      bots: 1,
    });
    const s = applyAction(r0.state, "stand").state;
    expect(s.bots[0].cards).toHaveLength(3);
    expect(s.bots[0].doubled).toBe(true);
    expect(s.bots[0].bet).toBe(200); // Vinny's cosmetic 100 × 2
  });

  it("never touches the player's chips", () => {
    const r0 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("6"), c("9"), c("9", "H"), c("5"), c("K", "D")),
      bots: 1,
    });
    const s = applyAction(r0.state, "stand").state;
    expect(s.staked).toBe(10);
    expect(s.payoutTotal).toBe(s.hands[0].payout);
    // player 19 vs dealer 19 pushes regardless of the bot's fate
    expect(netResult(s)).toBe(0);
  });

  it("dealer still draws for a live bot when the player busts", () => {
    const r0 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("K", "H"), c("2"), c("5"), c("9"), c("2", "H"), c("K", "D")),
      bots: 1,
    });
    const s = applyAction(r0.state, "hit").state; // player K+5+K busts
    expect(handValue(s.hands[0].cards).total).toBeGreaterThan(21);
    expect(s.phase).toBe("settled");
    expect(handValue(s.dealer).total).toBeGreaterThanOrEqual(17); // drew for the bot
    expect(s.bots[0].outcome).not.toBeNull();
  });

  it("dealer does not draw when player and all bots bust", () => {
    const r0 = startRound(10, {
      previousShoe: shoeFor(c("K"), c("K", "H"), c("K", "D"), c("5"), c("6"), c("5", "H"), c("K", "S"), c("K", "C")),
      bots: 1,
    });
    const s = applyAction(r0.state, "hit").state; // player busts; bot 16 vs 10 hits K → busts
    expect(handValue(s.bots[0].cards).total).toBeGreaterThan(21);
    expect(s.dealer).toHaveLength(2);
  });

  it("leaves bots at two cards on a dealer peek blackjack; bot naturals push", () => {
    const { state } = startRound(10, {
      previousShoe: shoeFor(c("K"), c("A"), c("9"), c("K", "H"), c("9", "H"), c("K", "D"), c("9", "D"), c("A", "H")),
      bots: 2,
    });
    expect(state.phase).toBe("settled"); // dealer K+A peeked blackjack
    expect(state.bots[0].cards).toHaveLength(2);
    expect(state.bots[1].cards).toHaveLength(2);
    expect(state.bots[0].outcome).toBe("push"); // bot natural A+K vs dealer BJ
    expect(state.bots[1].outcome).toBe("lose");
  });

  it("does not change the insurance cost", () => {
    const { state } = startRound(10, {
      previousShoe: shoeFor(c("5"), c("5", "H"), c("A"), c("6"), c("6", "H"), c("9", "H")),
      bots: 1,
    });
    expect(state.phase).toBe("insurance");
    expect(stateInsuranceCost(state)).toBe(5); // half of 10 × 1 player hand
  });

  it("rejects invalid bot counts", () => {
    expect(() => startRound(10, { bots: 4 })).toThrow(IllegalActionError);
    expect(() => startRound(10, { bots: -1 })).toThrow(IllegalActionError);
    expect(() => startRound(10, { bots: 1.5 })).toThrow(IllegalActionError);
  });
});

describe("perfect pairs", () => {
  // Deal order: player c1, dealer up, player c2, hole
  const ppRound = (c1: Card, c2: Card) =>
    startRound(10, {
      previousShoe: shoeFor(c1, c("9", "D"), c2, c("5", "H")),
      perfectPairs: 5,
    });

  it("pays 30:1 on a perfect pair, credited immediately at the deal", () => {
    const { state, debit, sideBetPayout } = ppRound(c("K", "H"), c("K", "H"));
    expect(debit).toBe(15); // 10 bet + 5 pairs leave the stack together
    expect(sideBetPayout).toBe(155); // …but the win comes right back on the spot
    expect(state.staked).toBe(10); // main-game accounting excludes the side bet
    expect(state.hands[0].pp).toEqual({ bet: 5, payout: 155, label: "perfect pair" });
    const settled = applyAction(state, "stand").state;
    // settle pays the main hand only — the side bet was already paid
    expect(settled.payoutTotal).toBe(settled.hands[0].payout);
  });

  it("pays 10:1 on a colored pair (same color, different suit)", () => {
    const { state } = ppRound(c("K", "H"), c("K", "D"));
    expect(state.hands[0].pp).toEqual({ bet: 5, payout: 55, label: "colored pair" });
    const black = ppRound(c("8", "S"), c("8", "C"));
    expect(black.state.hands[0].pp?.label).toBe("colored pair");
  });

  it("pays 5:1 on a mixed pair (different colors)", () => {
    const { state } = ppRound(c("K", "H"), c("K", "S"));
    expect(state.hands[0].pp).toEqual({ bet: 5, payout: 30, label: "mixed pair" });
  });

  it("loses the stake on no pair (zero immediate payout)", () => {
    const { state, sideBetPayout } = ppRound(c("K", "H"), c("9", "H"));
    expect(sideBetPayout).toBe(0);
    expect(state.hands[0].pp).toEqual({ bet: 5, payout: 0, label: "no pair" });
    const settled = applyAction(state, "stand").state;
    // netResult tracks the MAIN game only; the side-bet stake left with the debit
    expect(netResult(settled)).toBe(settled.payoutTotal - 10);
  });

  it("applies per seat and debits accordingly", () => {
    const { state, debit, sideBetPayout } = startRound(10, {
      previousShoe: shoeFor(
        c("K", "H"), c("2", "H"), c("9", "D"), c("K", "H"), c("3", "H"), c("5", "H")
      ),
      seats: 2,
      perfectPairs: 5,
    });
    expect(debit).toBe(30); // (10 + 5) × 2
    expect(sideBetPayout).toBe(155); // seat 1's perfect pair, paid on the spot
    expect(state.hands[0].pp?.label).toBe("perfect pair"); // K♥ + K♥
    expect(state.hands[1].pp?.payout).toBe(0); // 2♥ + 3♥
  });

  it("still pays a legacy in-flight Match the Dealer result at settle", () => {
    const { state } = startRound(10, { previousShoe: shoeFor(c("K", "H"), c("9", "D"), c("9", "H"), c("5", "H")) });
    state.hands[0].mtd = { bet: 5, payout: 25, label: "unsuited match" };
    const settled = applyAction(state, "stand").state;
    expect(settled.payoutTotal).toBe(settled.hands[0].payout + 25);
  });

  it("rejects invalid bets and passes through clientView", () => {
    expect(() => startRound(10, { perfectPairs: -1 })).toThrow(IllegalActionError);
    expect(() => startRound(10, { perfectPairs: 2.5 })).toThrow(IllegalActionError);
    const { state } = ppRound(c("K", "H"), c("K", "H"));
    expect(clientView(state).hands[0].pp?.payout).toBe(155);
  });
});

describe("even money", () => {
  // Player blackjack vs dealer ace: A♣, up A♥, K♣, hole = ?
  const bjVsAce = (hole: Card) =>
    startRound(10, { previousShoe: shoeFor(c("A", "C"), c("A", "H"), c("K", "C"), hole) });

  it("is offered instead of insurance when every hand is a natural", () => {
    const { state } = bjVsAce(c("K", "H"));
    expect(state.phase).toBe("insurance");
    expect(clientView(state).actions).toEqual(["even-money-yes", "even-money-no"]);
  });

  it("pays 1:1 immediately — even when the dealer has blackjack", () => {
    const { state } = bjVsAce(c("K", "H")); // dealer A+K = blackjack
    const settled = applyAction(state, "even-money-yes").state;
    expect(settled.phase).toBe("settled");
    expect(settled.hands[0].outcome).toBe("even-money");
    expect(settled.hands[0].payout).toBe(20); // bet × 2, guaranteed
    expect(netResult(settled)).toBe(10);
  });

  it("declining plays it out: push vs dealer BJ, 3:2 otherwise", () => {
    const pushed = applyAction(bjVsAce(c("K", "H")).state, "even-money-no").state;
    expect(pushed.hands[0].outcome).toBe("push");
    expect(netResult(pushed)).toBe(0);

    const paid = applyAction(bjVsAce(c("5", "H")).state, "even-money-no").state;
    expect(paid.hands[0].outcome).toBe("blackjack");
    expect(netResult(paid)).toBe(15); // 3:2
  });

  it("falls back to regular insurance when only one of two hands is a natural", () => {
    const { state } = startRound(10, {
      previousShoe: shoeFor(
        c("A", "C"), c("9", "C"), c("A", "H"), c("K", "C"), c("9", "H"), c("K", "H")
      ),
      seats: 2,
    });
    expect(state.phase).toBe("insurance");
    expect(clientView(state).actions).toEqual(["insurance-yes", "insurance-no"]);
    expect(() => applyAction(state, "even-money-yes")).toThrow(IllegalActionError);
  });

  it("is illegal outside the offer", () => {
    const { state } = startRound(10, shoeFor(c("5"), c("9"), c("6"), c("7")));
    expect(() => applyAction(state, "even-money-yes")).toThrow(IllegalActionError);
  });
});

describe("v0.4.0 compat", () => {
  it("sets shuffled true on a fresh shoe, false on a carried one", () => {
    const fresh = startRound(10);
    expect(fresh.shuffled).toBe(true);
    const carried = startRound(10, { previousShoe: shoeFor(c("5"), c("9"), c("6"), c("7")) });
    expect(carried.shuffled).toBe(false);
  });

  it("still supports the legacy positional signature", () => {
    const { state } = startRound(10, shoeFor(c("5"), c("9"), c("6"), c("7"), c("5", "H"), c("8")), undefined, 2);
    expect(state.hands).toHaveLength(2);
    expect(state.variant).toBe("classic");
    expect(state.bots).toEqual([]);
  });

  it("plays a v0.3.0-shaped persisted round to settlement", () => {
    // Hand-written pre-0.4.0 stateJson: no variant, runningCount, or bots
    const legacy = JSON.parse(JSON.stringify({
      shoe: Array.from({ length: 100 }, () => c("2", "D")),
      dealer: [c("9"), c("K")],
      hands: [
        { cards: [c("K", "H"), c("9", "H")], bet: 10, doubled: false, done: false, fromSplit: false, splitAces: false, outcome: null, payout: 0 },
      ],
      dealerRevealed: false,
      active: 0,
      phase: "player",
      baseBet: 10,
      insuranceBet: 0,
      splits: 0,
      staked: 10,
      payoutTotal: 0,
    })) as RoundState;

    const r = applyAction(legacy, "stand");
    expect(r.state.phase).toBe("settled");
    expect(r.state.hands[0].outcome).toBe("push"); // 19 vs 19
    expect(netResult(r.state)).toBe(0);
    const view = clientView(r.state);
    expect(view.bots).toEqual([]);
    expect(view.variant).toBe("classic");
  });
});
