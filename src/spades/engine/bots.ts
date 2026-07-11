import type { Card, Suit } from "./cards";
import { leadSuit, legalPlays } from "./rules";
import type { Bid, GameState, PlayedCard, Seat } from "./types";
import { teamOf } from "./types";

// Heuristic bot — no LLM. Bids from expected winners, then plays with a handful
// of durable Spades principles: win cheap, cover your partner, set the enemy,
// dump losers, and hunt a bidder who's set themselves a Nil.

// ── Bidding ──────────────────────────────────────────────────────────────────

/** Estimate tricks a hand will win, and decide whether to try Nil. */
export function botBid(hand: Card[]): Bid {
  const nil = shouldBidNil(hand);
  if (nil) return { tricks: 0, blind: false };

  const est = estimateTricks(hand);
  // Bots bid a touch conservatively (bags hurt); floor at 1 (Nil is separate).
  const tricks = Math.max(1, Math.min(13, Math.round(est)));
  return { tricks, blind: false };
}

function bySuit(hand: Card[]): Record<Suit, Card[]> {
  const m: Record<Suit, Card[]> = { C: [], D: [], H: [], S: [] };
  for (const c of hand) m[c.suit].push(c);
  for (const s of ["C", "D", "H", "S"] as Suit[]) m[s].sort((a, b) => b.rank - a.rank);
  return m;
}

/** Expected trick count: high spades + spade length, plus side aces/kings. */
export function estimateTricks(hand: Card[]): number {
  const suits = bySuit(hand);
  let est = 0;

  // Spades: aces/kings almost always win; extra length wins low spades late.
  const spades = suits.S;
  for (const c of spades) {
    if (c.rank === 14) est += 1;         // A♠
    else if (c.rank === 13) est += 0.9;  // K♠
    else if (c.rank === 12) est += 0.7;  // Q♠
  }
  const lowSpades = spades.filter((c) => c.rank < 12).length;
  if (spades.length > 3) est += (spades.length - 3) * 0.5; // length tricks
  else est += lowSpades * 0.15;

  // Side suits: aces win, kings usually, protected by length.
  for (const s of ["C", "D", "H"] as Suit[]) {
    const cs = suits[s];
    if (!cs.length) continue;
    if (cs[0].rank === 14) est += 0.95;                    // side ace
    if (cs.length >= 2 && cs.some((c) => c.rank === 13)) est += 0.6; // guarded K
    if (cs.length === 1 && cs[0].rank === 13) est += 0.35; // bare K (risky)
  }
  return est;
}

/** Try Nil only with a genuinely weak, duckable hand. */
export function shouldBidNil(hand: Card[]): boolean {
  const suits = bySuit(hand);
  const spades = suits.S;

  // Any high spade, or too many spades, makes a Nil hard to duck.
  if (spades.some((c) => c.rank >= 12)) return false;
  if (spades.length >= 4) return false;

  // Bare or nearly-bare aces are hard to duck; count danger cards.
  let danger = 0;
  for (const s of ["C", "D", "H"] as Suit[]) {
    const cs = suits[s];
    if (cs.some((c) => c.rank === 14) && cs.length <= 2) danger += 1; // shortish ace
    if (cs.some((c) => c.rank === 13) && cs.length <= 1) danger += 1; // bare king
  }
  const highSpade = spades.some((c) => c.rank >= 11);
  return danger === 0 && !highSpade && spades.length <= 2;
}

// ── Card play ────────────────────────────────────────────────────────────────

interface PlayCtx {
  seat: Seat;
  hand: Card[];
  trick: PlayedCard[];
  spadesBroken: boolean;
  bids: (Bid | null)[];
  partner: Seat;
}

export function botPlay(state: GameState, seat: Seat): Card {
  const legal = legalPlays(state.hands[seat], state.currentTrick, state.spadesBroken);
  if (legal.length === 1) return legal[0];

  const ctx: PlayCtx = {
    seat,
    hand: state.hands[seat],
    trick: state.currentTrick,
    spadesBroken: state.spadesBroken,
    bids: state.bids,
    partner: ((seat + 2) % 4) as Seat,
  };

  return state.currentTrick.length === 0 ? chooseLead(ctx, legal) : chooseFollow(ctx, legal);
}

const lowest = (cs: Card[]) => cs.reduce((a, b) => (b.rank < a.rank ? b : a));
const highest = (cs: Card[]) => cs.reduce((a, b) => (b.rank > a.rank ? b : a));

function isNilBidder(bids: (Bid | null)[], seat: Seat): boolean {
  return bids[seat]?.tricks === 0;
}

function chooseLead(ctx: PlayCtx, legal: Card[]): Card {
  const { bids, seat, partner } = ctx;

  // If I bid Nil, lead my lowest card to shed winners safely.
  if (isNilBidder(bids, seat)) return lowest(legal);

  // If my PARTNER bid Nil, lead high to grab the trick and cover them.
  if (isNilBidder(bids, partner)) {
    const nonSpade = legal.filter((c) => c.suit !== "S");
    return highest(nonSpade.length ? nonSpade : legal);
  }

  // If an OPPONENT bid Nil, lead a low card in a suit to try to force them to win.
  const oppNil = ([0, 1, 2, 3] as Seat[]).find(
    (s) => teamOf(s) !== teamOf(seat) && isNilBidder(bids, s));
  if (oppNil !== undefined) {
    const nonSpade = legal.filter((c) => c.suit !== "S");
    if (nonSpade.length) return lowest(nonSpade);
  }

  // Default: lead a high card from my strongest side suit to cash a winner,
  // keeping spades for later control. Avoid leading a spade if I have options.
  const nonSpade = legal.filter((c) => c.suit !== "S");
  const pool = nonSpade.length ? nonSpade : legal;
  const aces = pool.filter((c) => c.rank === 14);
  if (aces.length) return aces[0];
  return highest(pool);
}

function chooseFollow(ctx: PlayCtx, legal: Card[]): Card {
  const { trick, seat, partner, bids } = ctx;
  const lead = leadSuit(trick)!;
  const partnerWinning = currentWinner(trick) === partner;
  const iMustWinForNil = isNilBidder(bids, partner); // cover partner's nil

  const following = legal.filter((c) => c.suit === lead);

  if (following.length) {
    // I can follow suit.
    if (isNilBidder(bids, seat)) {
      // I'm Nil: duck under the current high if possible, else play my lowest.
      const highSoFar = maxRankOfSuit(trick, lead);
      const safe = following.filter((c) => c.rank < highSoFar);
      return safe.length ? highest(safe) : lowest(following);
    }
    if (partnerWinning && !iMustWinForNil) {
      // Partner has it → throw my lowest, don't overtake.
      return lowest(following);
    }
    // Try to win cheaply: lowest card that beats the current best of the lead suit.
    const toBeat = maxRankOfSuit(trick, lead);
    const winners = following.filter((c) => c.rank > toBeat);
    // Only worth winning if no spade has trumped in yet.
    if (winners.length && !trickHasSpade(trick, lead)) return lowest(winners);
    return lowest(following); // can't or shouldn't win → dump lowest
  }

  // Void in lead suit → trump or discard.
  const spades = legal.filter((c) => c.suit === "S");
  if (isNilBidder(bids, seat)) {
    // Never trump on a nil; discard the highest dangerous non-spade.
    const nonSpade = legal.filter((c) => c.suit !== "S");
    return highest(nonSpade.length ? nonSpade : legal);
  }
  if (partnerWinning && !iMustWinForNil) {
    // Partner winning → don't waste a trump, discard my lowest loser.
    const nonSpade = legal.filter((c) => c.suit !== "S");
    return lowest(nonSpade.length ? nonSpade : legal);
  }
  if (spades.length) {
    // Trump to win — lowest spade that beats any spade already in the trick.
    const topSpade = maxRankOfSuit(trick, "S");
    const beats = spades.filter((c) => c.rank > topSpade);
    return (beats.length ? lowest(beats) : lowest(spades));
  }
  // No spades → discard lowest.
  return lowest(legal);
}

function currentWinner(trick: PlayedCard[]): Seat | null {
  if (!trick.length) return null;
  const lead = trick[0].card.suit;
  const spades = trick.filter((p) => p.card.suit === "S");
  const pool = spades.length ? spades : trick.filter((p) => p.card.suit === lead);
  return pool.reduce((a, b) => (b.card.rank > a.card.rank ? b : a)).seat;
}

function maxRankOfSuit(trick: PlayedCard[], suit: Suit): number {
  const cs = trick.filter((p) => p.card.suit === suit).map((p) => p.card.rank);
  return cs.length ? Math.max(...cs) : 0;
}

function trickHasSpade(trick: PlayedCard[], lead: Suit): boolean {
  return lead !== "S" && trick.some((p) => p.card.suit === "S");
}
