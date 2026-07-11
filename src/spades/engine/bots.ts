import type { Card, Suit, SpadesRules } from "./cards";
import { effSuit, isTrump, trumpRank, STANDARD_RULES } from "./cards";
import { leadSuit, legalPlays } from "./rules";
import type { Bid, GameState, PlayedCard, Seat } from "./types";
import { teamOf } from "./types";

// Heuristic bot — no LLM. Bids from expected winners, then plays with a handful
// of durable Spades principles: win cheap, cover your partner, set the enemy,
// dump losers, and hunt a bidder who's set themselves a Nil. All suit/rank logic
// is trump-aware, so it adapts when "deuces high" promotes the 2s to top trumps.

// ── Bidding ──────────────────────────────────────────────────────────────────

/** Estimate tricks a hand will win, and decide whether to try Nil. */
export function botBid(hand: Card[], rules: SpadesRules = STANDARD_RULES): Bid {
  const nil = shouldBidNil(hand, rules);
  if (nil) return { tricks: 0, blind: false };

  const est = estimateTricks(hand, rules);
  // Bots bid a touch conservatively (bags hurt); floor at 1 (Nil is separate).
  const tricks = Math.max(1, Math.min(13, Math.round(est)));
  return { tricks, blind: false };
}

/** Group a hand by *effective* suit, so promoted deuces sit with the spades. */
function bySuit(hand: Card[], rules: SpadesRules): Record<Suit, Card[]> {
  const m: Record<Suit, Card[]> = { C: [], D: [], H: [], S: [] };
  for (const c of hand) m[effSuit(c, rules)].push(c);
  for (const s of ["C", "D", "H", "S"] as Suit[]) {
    m[s].sort((a, b) => s === "S"
      ? trumpRank(b, rules) - trumpRank(a, rules)
      : b.rank - a.rank);
  }
  return m;
}

const isHotDeuce = (c: Card, rules: SpadesRules) => rules.deucesHigh && c.rank === 2;

/** Expected trick count: high spades + spade length, plus side aces/kings. */
export function estimateTricks(hand: Card[], rules: SpadesRules = STANDARD_RULES): number {
  const suits = bySuit(hand, rules);
  let est = 0;

  // Trumps: promoted deuces are near-locks; aces/kings almost always win; extra
  // length wins low spades late.
  const spades = suits.S;
  for (const c of spades) {
    if (isHotDeuce(c, rules)) est += 1;   // promoted deuce = a top trump
    else if (c.rank === 14) est += 1;     // A♠
    else if (c.rank === 13) est += 0.9;   // K♠
    else if (c.rank === 12) est += 0.7;   // Q♠
  }
  const lowSpades = spades.filter((c) => c.rank < 12 && !isHotDeuce(c, rules)).length;
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
export function shouldBidNil(hand: Card[], rules: SpadesRules = STANDARD_RULES): boolean {
  const suits = bySuit(hand, rules);
  const spades = suits.S;

  // A promoted deuce is a guaranteed top trump → Nil is hopeless.
  if (spades.some((c) => isHotDeuce(c, rules))) return false;
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
  rules: SpadesRules;
}

export function botPlay(state: GameState, seat: Seat): Card {
  const rules = state.rules;
  const legal = legalPlays(state.hands[seat], state.currentTrick, state.spadesBroken, rules);
  if (legal.length === 1) return legal[0];

  const ctx: PlayCtx = {
    seat,
    hand: state.hands[seat],
    trick: state.currentTrick,
    spadesBroken: state.spadesBroken,
    bids: state.bids,
    partner: ((seat + 2) % 4) as Seat,
    rules,
  };

  return state.currentTrick.length === 0 ? chooseLead(ctx, legal) : chooseFollow(ctx, legal);
}

// Selectors keyed by an arbitrary strength function (rank, or trump strength).
const lowestBy = (cs: Card[], k: (c: Card) => number) =>
  cs.reduce((a, b) => (k(b) < k(a) ? b : a));
const highestBy = (cs: Card[], k: (c: Card) => number) =>
  cs.reduce((a, b) => (k(b) > k(a) ? b : a));
const byRank = (c: Card) => c.rank;
const lowest = (cs: Card[]) => lowestBy(cs, byRank);
const highest = (cs: Card[]) => highestBy(cs, byRank);

function isNilBidder(bids: (Bid | null)[], seat: Seat): boolean {
  return bids[seat]?.tricks === 0;
}

function chooseLead(ctx: PlayCtx, legal: Card[]): Card {
  const { bids, seat, partner, rules } = ctx;
  const trumpStr = (c: Card) => trumpRank(c, rules);
  const nonTrump = legal.filter((c) => !isTrump(c, rules));

  // If I bid Nil, lead my lowest card to shed winners safely.
  if (isNilBidder(bids, seat)) {
    return nonTrump.length ? lowest(nonTrump) : lowestBy(legal, trumpStr);
  }

  // If my PARTNER bid Nil, lead high to grab the trick and cover them.
  if (isNilBidder(bids, partner)) {
    return nonTrump.length ? highest(nonTrump) : highestBy(legal, trumpStr);
  }

  // If an OPPONENT bid Nil, lead a low card in a suit to try to force them to win.
  const oppNil = ([0, 1, 2, 3] as Seat[]).find(
    (s) => teamOf(s) !== teamOf(seat) && isNilBidder(bids, s));
  if (oppNil !== undefined && nonTrump.length) return lowest(nonTrump);

  // Default: lead a high card from my strongest side suit to cash a winner,
  // keeping trumps for later control. Avoid leading trump if I have options.
  const pool = nonTrump.length ? nonTrump : legal;
  const aces = pool.filter((c) => c.rank === 14 && !isTrump(c, rules));
  if (aces.length) return aces[0];
  return nonTrump.length ? highest(pool) : highestBy(pool, trumpStr);
}

function chooseFollow(ctx: PlayCtx, legal: Card[]): Card {
  const { trick, seat, partner, bids, rules } = ctx;
  const lead = leadSuit(trick, rules)!;
  const partnerWinning = currentWinner(trick, rules) === partner;
  const iMustWinForNil = isNilBidder(bids, partner); // cover partner's nil

  // Strength within the lead suit: trump strength if trumps were led, else rank.
  const leadStr = (c: Card) => (lead === "S" ? trumpRank(c, rules) : c.rank);
  const following = legal.filter((c) => effSuit(c, rules) === lead);

  if (following.length) {
    // I can follow suit.
    if (isNilBidder(bids, seat)) {
      // I'm Nil: duck under the current high if possible, else play my lowest.
      const highSoFar = maxLeadStrength(trick, lead, rules);
      const safe = following.filter((c) => leadStr(c) < highSoFar);
      return safe.length ? highestBy(safe, leadStr) : lowestBy(following, leadStr);
    }
    if (partnerWinning && !iMustWinForNil) {
      // Partner has it → throw my lowest, don't overtake.
      return lowestBy(following, leadStr);
    }
    // Try to win cheaply: lowest card that beats the current best of the lead suit.
    const toBeat = maxLeadStrength(trick, lead, rules);
    const winners = following.filter((c) => leadStr(c) > toBeat);
    // Only worth winning if no trump has cut in on a non-trump lead.
    if (winners.length && !trumpedIn(trick, lead, rules)) return lowestBy(winners, leadStr);
    return lowestBy(following, leadStr); // can't or shouldn't win → dump lowest
  }

  // Void in lead suit → trump or discard.
  const trumps = legal.filter((c) => isTrump(c, rules));
  const trumpStr = (c: Card) => trumpRank(c, rules);
  if (isNilBidder(bids, seat)) {
    // Never trump on a nil; discard the highest dangerous non-trump.
    const nonTrump = legal.filter((c) => !isTrump(c, rules));
    return highest(nonTrump.length ? nonTrump : legal);
  }
  if (partnerWinning && !iMustWinForNil) {
    // Partner winning → don't waste a trump, discard my lowest loser.
    const nonTrump = legal.filter((c) => !isTrump(c, rules));
    return lowest(nonTrump.length ? nonTrump : legal);
  }
  if (trumps.length) {
    // Trump to win — lowest trump that beats any trump already in the trick.
    const topTrump = maxTrumpStrength(trick, rules);
    const beats = trumps.filter((c) => trumpRank(c, rules) > topTrump);
    return (beats.length ? lowestBy(beats, trumpStr) : lowestBy(trumps, trumpStr));
  }
  // No trumps → discard lowest.
  return lowest(legal);
}

function currentWinner(trick: PlayedCard[], rules: SpadesRules): Seat | null {
  if (!trick.length) return null;
  const lead = effSuit(trick[0].card, rules);
  const trumps = trick.filter((p) => isTrump(p.card, rules));
  if (trumps.length) {
    return trumps.reduce((a, b) =>
      (trumpRank(b.card, rules) > trumpRank(a.card, rules) ? b : a)).seat;
  }
  const pool = trick.filter((p) => effSuit(p.card, rules) === lead);
  return pool.reduce((a, b) => (b.card.rank > a.card.rank ? b : a)).seat;
}

/** Best strength among cards of the (effective) lead suit already in the trick. */
function maxLeadStrength(trick: PlayedCard[], lead: Suit, rules: SpadesRules): number {
  const xs = trick
    .filter((p) => effSuit(p.card, rules) === lead)
    .map((p) => (lead === "S" ? trumpRank(p.card, rules) : p.card.rank));
  return xs.length ? Math.max(...xs) : 0;
}

/** Best trump strength already in the trick (0 if none). */
function maxTrumpStrength(trick: PlayedCard[], rules: SpadesRules): number {
  const xs = trick.filter((p) => isTrump(p.card, rules)).map((p) => trumpRank(p.card, rules));
  return xs.length ? Math.max(...xs) : 0;
}

/** Has a trump cut in on a non-trump lead? */
function trumpedIn(trick: PlayedCard[], lead: Suit, rules: SpadesRules): boolean {
  return lead !== "S" && trick.some((p) => isTrump(p.card, rules));
}
