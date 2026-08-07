import { describe, it, expect } from "vitest";
import { autoAct, BOT_SEATS, HUMAN_SEATS, isBotSeat, resolveBotTurns } from "./auto";
import { newGame } from "./game";
import { botBid } from "./bots";
import { STANDARD_RULES } from "./cards";
import type { GameState, Seat } from "./types";

// Deterministic RNG (mulberry32) so bot bids/plays and the deal itself are
// reproducible across test runs.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("seat identity", () => {
  it("bots always sit at 1 & 3, humans at 0 & 2", () => {
    expect(BOT_SEATS).toEqual([1, 3]);
    expect(HUMAN_SEATS).toEqual([0, 2]);
    expect(isBotSeat(1)).toBe(true);
    expect(isBotSeat(3)).toBe(true);
    expect(isBotSeat(0)).toBe(false);
    expect(isBotSeat(2)).toBe(false);
  });
});

describe("autoAct — one heuristic, two purposes (bot seats and timed-out humans)", () => {
  it("advances a bidding turn by applying the bot's own recommended bid, for a bot seat", () => {
    const rng = mulberry32(1);
    const state = newGame(rng, 500, STANDARD_RULES);
    expect(state.phase).toBe("bidding");
    const seat = state.turn;
    const expectedBid = botBid(state.hands[seat], state.rules);

    const next = autoAct(state, seat);
    expect(next.bids[seat]).toEqual(expectedBid);
  });

  it("produces the exact same forced bid for a HUMAN seat whose timer expired as it would for a bot — same code path", () => {
    const rng = mulberry32(2);
    let state = newGame(rng, 500, STANDARD_RULES);
    // Fast-forward to a human seat's bidding turn (0 or 2) regardless of
    // where the deal happened to start.
    while (!HUMAN_SEATS.includes(state.turn)) {
      state = autoAct(state, state.turn);
    }
    const seat = state.turn as Seat;
    const expectedBid = botBid(state.hands[seat], state.rules);

    const next = autoAct(state, seat);
    expect(next.bids[seat]).toEqual(expectedBid);
    expect(next.turn).not.toBe(seat); // turn actually advanced
  });

  it("is a no-op when the state has moved on and it's no longer that seat's turn (stale enforcement)", () => {
    const rng = mulberry32(3);
    const state = newGame(rng, 500, STANDARD_RULES);
    const seat = state.turn;
    const other = ((seat + 1) % 4) as Seat;
    const result = autoAct(state, other);
    expect(result).toBe(state); // returned unchanged, not mutated or advanced
  });

  it("plays a legal card for a bot seat during the playing phase", () => {
    const rng = mulberry32(4);
    let state = newGame(rng, 500, STANDARD_RULES);
    // Resolve bidding for all four seats via autoAct (bots + "timed-out humans").
    while (state.phase === "bidding") state = autoAct(state, state.turn);
    expect(state.phase).toBe("playing");

    const seat = state.turn;
    const before = state.hands[seat].length;
    const next = autoAct(state, seat);
    // Either the card left the hand (trick still in progress) or a trick
    // resolved and hands updated for all seats — either way this seat has
    // one fewer card than before.
    expect(next.hands[seat].length).toBe(before - 1);
  });
});

describe("resolveBotTurns", () => {
  it("resolves consecutive bot turns and stops exactly at a human seat's turn during bidding", () => {
    const rng = mulberry32(5);
    const state = newGame(rng, 500, STANDARD_RULES);
    const resolved = resolveBotTurns(state);
    expect(resolved.phase === "bidding" || resolved.phase === "playing").toBe(true);
    if (resolved.bids.some((b) => b === null)) {
      // Still bidding — must have stopped on a human seat.
      expect(HUMAN_SEATS.includes(resolved.turn)).toBe(true);
    }
  });

  it("never leaves the resolved state parked on a bot seat's turn", () => {
    const rng = mulberry32(6);
    let state = newGame(rng, 500, STANDARD_RULES);
    // Drive several turns forward via the real reducer + resolveBotTurns,
    // checking the invariant holds at every step.
    for (let i = 0; i < 8; i++) {
      state = resolveBotTurns(state);
      if (state.phase !== "bidding" && state.phase !== "playing") break;
      expect(isBotSeat(state.turn)).toBe(false);
      // A human acts with the bot's own recommendation too (simulating a
      // timed-out turn), then bots cascade again.
      state = autoAct(state, state.turn);
    }
  });

  it("is idempotent once parked on a human turn (calling it again changes nothing)", () => {
    const rng = mulberry32(7);
    const state = resolveBotTurns(newGame(rng, 500, STANDARD_RULES));
    const again = resolveBotTurns(state);
    expect(again).toEqual(state);
  });

  it("does nothing once the hand is complete — turn is stale, not a bot cascade trigger", () => {
    const rng = mulberry32(8);
    let state = newGame(rng, 500, STANDARD_RULES);
    // Force through bidding.
    while (state.phase === "bidding") state = autoAct(state, state.turn);
    // Play every card of the entire hand via the bot heuristic, regardless
    // of seat, to reach handComplete/gameOver quickly and deterministically.
    let guard = 0;
    while (state.phase === "playing" && guard++ < 100) {
      state = autoAct(state, state.turn);
    }
    expect(["handComplete", "gameOver"]).toContain(state.phase);
    const result = resolveBotTurns(state);
    expect(result).toBe(state);
  });
});

describe("autoAct never sees or needs a viewer-redacted state (defense in depth)", () => {
  it("operates on the full GameState — a smoke test that autoAct's inputs/outputs are plain GameState, not a client view", () => {
    const rng = mulberry32(9);
    const state: GameState = newGame(rng, 500, STANDARD_RULES);
    const next = autoAct(state, state.turn);
    // playCard/placeBid always return a full GameState; this just guards
    // against an accidental future refactor that threads a redacted view
    // through the bot/timeout path by mistake.
    expect(next).toHaveProperty("hands");
    expect(next.hands).toHaveLength(4);
  });
});
