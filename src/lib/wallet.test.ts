import { describe, expect, it } from "vitest";
import {
  balanceField,
  creditData,
  readBalance,
  totalWorth,
  WALLET_SELECT,
} from "./wallet";

const user = { chips: 10_000, triluxChips: 2_500 };

describe("balanceField", () => {
  it("maps trilux to its own column and everything else to main", () => {
    expect(balanceField("trilux")).toBe("triluxChips");
    expect(balanceField("classic")).toBe("chips");
  });

  it("defaults to main when no room is given (pre-0.50.0 rounds)", () => {
    expect(balanceField()).toBe("chips");
  });
});

describe("readBalance", () => {
  it("reads the wallet that backs play at the room", () => {
    expect(readBalance(user, "classic")).toBe(10_000);
    expect(readBalance(user, "trilux")).toBe(2_500);
    expect(readBalance(user)).toBe(10_000);
  });
});

describe("creditData", () => {
  it("credits the room's own wallet", () => {
    expect(creditData("classic", 500)).toEqual({ chips: { increment: 500 } });
    expect(creditData("trilux", 500)).toEqual({ triluxChips: { increment: 500 } });
  });

  it("debits via a negative delta", () => {
    expect(creditData("trilux", -75)).toEqual({ triluxChips: { increment: -75 } });
  });

  it("never touches the other wallet", () => {
    expect(creditData("trilux", 500)).not.toHaveProperty("chips");
    expect(creditData("classic", 500)).not.toHaveProperty("triluxChips");
  });
});

describe("totalWorth", () => {
  it("sums both wallets", () => {
    expect(totalWorth(user)).toBe(12_500);
  });

  // The regression this whole module exists to prevent: moving money between
  // wallets must not change how rich the player looks to High Rollers or VIP.
  it("is invariant under a transfer between wallets", () => {
    const before = totalWorth(user);
    const afterTransfer = { chips: user.chips - 4_000, triluxChips: user.triluxChips + 4_000 };
    expect(totalWorth(afterTransfer)).toBe(before);
  });

  it("handles an untouched player whose Trilux wallet is still zero", () => {
    expect(totalWorth({ chips: 10_000, triluxChips: 0 })).toBe(10_000);
  });
});

describe("WALLET_SELECT", () => {
  it("covers both wallets so a caller can't select just one", () => {
    expect(WALLET_SELECT).toEqual({ chips: true, triluxChips: true });
  });
});
