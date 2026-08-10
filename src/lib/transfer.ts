// Validation for moving chips between the main and Trilux wallets.
// Pure — no prisma — so every rule is unit-testable without a database.

export type TransferDirection = "to-trilux" | "to-main";

export const TRANSFER_DIRECTIONS: TransferDirection[] = ["to-trilux", "to-main"];

/** Upper bound per transfer. Not a balance check — just a sanity ceiling. */
export const MAX_TRANSFER = 1_000_000;

export interface TransferCheck {
  ok: boolean;
  /** Set when ok === false. Safe to show the player verbatim. */
  error?: string;
}

/**
 * Validate a proposed transfer against the source wallet's balance.
 *
 * Deliberately rejects zero as well as negatives: a zero transfer is always a
 * client bug, and letting it through would write a pointless audit-visible
 * no-op. Non-integers are rejected outright rather than rounded — silently
 * turning 0.5 into 0 or 1 is how money bugs start.
 */
export function checkTransfer(
  amount: unknown,
  sourceBalance: number
): TransferCheck {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { ok: false, error: "Transfer amount must be a number" };
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, error: "Transfer amount must be a whole number of chips" };
  }
  if (amount <= 0) {
    return { ok: false, error: "Transfer amount must be greater than zero" };
  }
  if (amount > MAX_TRANSFER) {
    return { ok: false, error: `Transfer amount cannot exceed ${MAX_TRANSFER.toLocaleString()}` };
  }
  if (amount > sourceBalance) {
    return { ok: false, error: "Not enough chips in that wallet" };
  }
  return { ok: true };
}

/** Is this a direction the API recognises? */
export function isTransferDirection(v: unknown): v is TransferDirection {
  return typeof v === "string" && TRANSFER_DIRECTIONS.includes(v as TransferDirection);
}
