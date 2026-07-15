// Pure blackjack rules engine — no framework, no I/O, fully deterministic
// given a shoe. All money amounts are integer chips.
//
// House rules (both variants):
//   - 6-deck shoe, reshuffled when fewer than 25% of cards remain
//   - Blackjack pays 3:2, dealer peeks on ace/ten (US rules)
//   - Dealer stands on soft 17
//   - Double on any first two cards, including after split
//   - Split equal ranks, one re-split allowed (max 3 hands)
//   - Split aces receive exactly one card each; 21 after split is not blackjack
//   - Insurance offered on dealer ace, pays 2:1
//
// Spanish 21 variant additionally:
//   - 48-card decks (all four 10s removed; J/Q/K stay)
//   - Player 21 and player blackjack ALWAYS win, even against dealer 21/BJ
//   - Late surrender on the first two cards (returns half the bet)
//   - Bonus 21 payouts (void after doubling): 5-card 21 pays 3:2, 6-card 2:1,
//     7+ card 3:1; 6-7-8 or 7-7-7 pays 3:2 mixed suits, 2:1 suited, 3:1 spades
//
// Perfect Pairs side bet (per seat): the seat's own first two cards as a
// pair — mixed 5:1, colored 10:1, perfect 30:1 — resolved at the deal.
//
// 21+3 side bet (per seat): the seat's first two cards + the dealer upcard
// as a three-card poker hand — flush 5:1, straight 10:1, three of a kind
// 30:1, straight flush 40:1, suited trips 100:1 — resolved at the deal.
//
// Lucky Ladies side bet (per seat): the seat's first two cards totaling 20 —
// any 20 pays 4:1, suited 20 9:1, matched 20 (identical cards) 19:1, and a
// Queen of Hearts pair 125:1, all resolved at the deal. A Queen of Hearts
// pair TOGETHER WITH a dealer blackjack additionally hits the progressive
// jackpot: the engine flags `llJackpot` on the first eligible hand at settle
// (when the dealer blackjack becomes public); the API pays the pot.
//
// Up to MAX_BOTS simulated players can share the table. Bots consume real
// cards from the shoe (so card counting stays honest) and settle against the
// dealer for display, but never touch the human player's chips.
//
// Hi-Lo running count: every card dealt face-up increments `runningCount`
// (+1 for 2-6, 0 for 7-9, -1 for 10/J/Q/K/A); the dealer hole card is counted
// at reveal. The count carries across rounds with the shoe.
//
// Shoe-depth margin: `splits` is a ROUND-wide counter (not per seat) — at
// most 2 splits happen per round no matter how many seats are in play, so
// worst-case total hands = MAX_SEATS + 2, not MAX_SEATS x 3. At the reshuffle
// floor (Spanish, 72 cards) that's 3 seats + 2 splits + 3 bots + dealer =
// 9 hands sharing the shoe, ~50 cards worst case — still safe margin.

export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Outcome = "blackjack" | "win" | "push" | "lose" | "surrender" | "even-money";

export type Variant = "classic" | "spanish21";

/** Table rules derived from the variant — never persisted, always recomputed. */
export interface Rules {
  variant: Variant;
  cardsPerDeck: 52 | 48;
  shoeSize: number;
  reshuffleAt: number;
  removeTens: boolean;
  player21AlwaysWins: boolean;
  lateSurrender: boolean;
  bonus21: boolean;
  /** Perfect Pairs side bet: X-to-1 by pair type. */
  ppMixed: number;
  ppColored: number;
  ppPerfect: number;
  /** 21+3 side bet: X-to-1 by three-card poker hand. */
  tpFlush: number;
  tpStraight: number;
  tpTrips: number;
  tpStraightFlush: number;
  tpSuitedTrips: number;
  /** Lucky Ladies side bet: X-to-1 by kind of 20. */
  llAny20: number;
  llSuited20: number;
  llMatched20: number;
  llQueenOfHearts: number;
}

export function rulesFor(variant: Variant = "classic"): Rules {
  const spanish = variant === "spanish21";
  const cardsPerDeck = spanish ? 48 : 52;
  const shoeSize = SHOE_DECKS * cardsPerDeck;
  return {
    variant,
    cardsPerDeck,
    shoeSize,
    reshuffleAt: Math.floor(shoeSize * 0.25),
    removeTens: spanish,
    player21AlwaysWins: spanish,
    lateSurrender: spanish,
    bonus21: spanish,
    // Common US Perfect Pairs paytable: mixed 5:1, colored 10:1, perfect 30:1
    ppMixed: 5,
    ppColored: 10,
    ppPerfect: 30,
    // Standard Vegas 21+3 paytable
    tpFlush: 5,
    tpStraight: 10,
    tpTrips: 30,
    tpStraightFlush: 40,
    tpSuitedTrips: 100,
    // Lucky Ladies (progressive variant paytable; the QoH-pair + dealer-BJ
    // jackpot itself is a site-wide pot handled by the API)
    llAny20: 4,
    llSuited20: 9,
    llMatched20: 19,
    llQueenOfHearts: 125,
  };
}

/** Side-bet result attached to a hand at the deal (Perfect Pairs today). */
export interface SideBetResult {
  bet: number;
  /** 0 on a loss; stake + winnings on a win. */
  payout: number;
  label: string;
}

export interface HandState {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  outcome: Outcome | null;
  payout: number;
  /** Spanish 21 bonus that paid on this hand (e.g. "5-Card 21"), for the UI. */
  bonus?: string;
  /** Perfect Pairs side bet, resolved at the deal. */
  pp?: SideBetResult;
  /** 21+3 side bet, resolved at the deal. */
  tp?: SideBetResult;
  /** Lucky Ladies side bet, resolved at the deal. */
  ll?: SideBetResult;
  /** Queen of Hearts pair — eligible for the jackpot if the dealer has blackjack. */
  llQueens?: boolean;
  /** Set at settle: this hand hit the Lucky Ladies progressive (API pays the pot). */
  llJackpot?: boolean;
  /** Legacy Match the Dealer field — only read at settle for in-flight rounds. */
  mtd?: SideBetResult;
}

/** A simulated player's hand. Cosmetic bet — never touches the human's chips. */
export interface BotHand {
  name: string;
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  outcome: Outcome | null;
}

export type Phase = "insurance" | "player" | "settled";

export interface RoundState {
  shoe: Card[];
  dealer: Card[];
  dealerRevealed: boolean;
  hands: HandState[];
  active: number;
  phase: Phase;
  baseBet: number;
  /** null = pending decision (phase "insurance"), 0 = declined, >0 = taken */
  insuranceBet: number | null;
  splits: number;
  /** Total chips debited from the player this round (bets + insurance). */
  staked: number;
  /** Total chips returned to the player at settlement. */
  payoutTotal: number;
  /** Game variant. Absent in pre-0.4.0 persisted rounds → classic. */
  variant: Variant;
  /** Hi-Lo running count of every card seen since the shuffle. */
  runningCount: number;
  /** Simulated players at the table. Absent in pre-0.4.0 rounds → none. */
  bots: BotHand[];
}

export type PlayerAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "surrender"
  | "insurance-yes"
  | "insurance-no"
  | "even-money-yes"
  | "even-money-no";

/** Result of applying an action: new state + chips to debit immediately. */
export interface ActionResult {
  state: RoundState;
  debit: number;
  /** True when startRound built a fresh shoe (UI plays the shuffle). */
  shuffled?: boolean;
  /** Side-bet winnings to credit IMMEDIATELY at the deal (paid on the spot). */
  sideBetPayout?: number;
}

export class IllegalActionError extends Error {}

const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS: Suit[] = ["S", "H", "D", "C"];

export const SHOE_DECKS = 6;
export const SHOE_SIZE = SHOE_DECKS * 52;
/** Reshuffle threshold: fewer cards than this left → new shoe next round. */
export const RESHUFFLE_AT = Math.floor(SHOE_SIZE * 0.25);

export type Rng = () => number;

function defaultRng(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}

export function createShoe(rng: Rng = defaultRng, rules: Rules = rulesFor()): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < SHOE_DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (rules.removeTens && rank === "10") continue;
        shoe.push({ rank, suit });
      }
    }
  }
  // Fisher–Yates
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** Hi-Lo card counting value: 2-6 → +1, 7-9 → 0, 10/J/Q/K/A → −1. */
export function hiLo(card: Card): 1 | 0 | -1 {
  if (card.rank === "A" || cardValue(card) === 10) return -1;
  if (cardValue(card) <= 6) return 1;
  return 0;
}

export function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (card.rank === "J" || card.rank === "Q" || card.rank === "K") return 10;
  return parseInt(card.rank, 10);
}

/** Best hand total, treating aces as 11 where possible without busting. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBust(cards: Card[]): boolean {
  return handValue(cards).total > 21;
}

/** Natural blackjack: two-card 21 on a non-split hand. */
export function isBlackjack(hand: Pick<HandState, "cards" | "fromSplit">): boolean {
  return (
    !hand.fromSplit &&
    hand.cards.length === 2 &&
    handValue(hand.cards).total === 21
  );
}

function dealerHasBlackjack(dealer: Card[]): boolean {
  return dealer.length === 2 && handValue(dealer).total === 21;
}

function draw(state: RoundState, visible = true): Card {
  const card = state.shoe.pop();
  if (!card) throw new Error("Shoe exhausted"); // 6 decks: unreachable in a legal round
  if (visible) state.runningCount = (state.runningCount ?? 0) + hiLo(card);
  return card;
}

/** Fill in fields absent from pre-0.4.0 persisted rounds. */
function normalizeState(state: RoundState): RoundState {
  state.variant ??= "classic";
  state.runningCount ??= 0;
  state.bots ??= [];
  return state;
}

function newHand(cards: Card[], bet: number, fromSplit = false, splitAces = false): HandState {
  return {
    cards,
    bet,
    doubled: false,
    done: false,
    fromSplit,
    splitAces,
    outcome: null,
    payout: 0,
  };
}

export function blackjackPayout(bet: number): number {
  return bet + Math.floor(bet * 1.5);
}

export function insuranceCost(baseBet: number): number {
  return Math.floor(baseBet / 2);
}

export const MAX_SEATS = 3;
export const MAX_BOTS = 3;

/** Fixed bot personas — bot i always gets persona i so names are stable. */
const BOT_SEATS: { name: string; bet: number }[] = [
  { name: "Vinny", bet: 100 },
  { name: "Ruth", bet: 25 },
  { name: "Doc", bet: 50 },
];

export interface RoundOptions {
  previousShoe?: Card[] | null;
  /** Variant the previousShoe was built for — mismatch forces a reshuffle. */
  previousVariant?: Variant;
  /** Hi-Lo running count carried with the shoe. */
  previousCount?: number;
  rng?: Rng;
  seats?: number;
  variant?: Variant;
  /** Simulated players at the table, 0–MAX_BOTS. */
  bots?: number;
  /** Perfect Pairs side bet per seat (0 = none). */
  perfectPairs?: number;
  /** 21+3 side bet per seat (0 = none). */
  twentyOnePlusThree?: number;
  /** Lucky Ladies side bet per seat (0 = none). */
  luckyLadies?: number;
}

/**
 * Start a round with `seats` simultaneous hands (same bet each).
 * `debit` = bet × seats (caller must have already verified the player can
 * afford it). Reuses the previous shoe when it still has enough penetration
 * left and was built for the same variant, otherwise builds a fresh shoe
 * (`shuffled: true` on the result).
 */
export function startRound(bet: number, options?: RoundOptions): ActionResult;
/** @deprecated positional form kept for the static build. */
export function startRound(
  bet: number,
  previousShoe?: Card[] | null,
  rng?: Rng,
  seats?: number
): ActionResult;
export function startRound(
  bet: number,
  arg2?: RoundOptions | Card[] | null,
  rngArg?: Rng,
  seatsArg?: number
): ActionResult {
  const opts: RoundOptions =
    arg2 && !Array.isArray(arg2)
      ? arg2
      : { previousShoe: arg2 as Card[] | null | undefined, rng: rngArg, seats: seatsArg };

  const rng = opts.rng ?? defaultRng;
  const seats = opts.seats ?? 1;
  const variant = opts.variant ?? "classic";
  const bots = opts.bots ?? 0;
  const ppBet = opts.perfectPairs ?? 0;
  const tpBet = opts.twentyOnePlusThree ?? 0;
  const llBet = opts.luckyLadies ?? 0;
  const rules = rulesFor(variant);

  if (!Number.isInteger(bet) || bet <= 0) {
    throw new IllegalActionError("Bet must be a positive integer");
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw new IllegalActionError(`Seats must be between 1 and ${MAX_SEATS}`);
  }
  if (!Number.isInteger(bots) || bots < 0 || bots > MAX_BOTS) {
    throw new IllegalActionError(`Bots must be between 0 and ${MAX_BOTS}`);
  }
  if (!Number.isInteger(ppBet) || ppBet < 0) {
    throw new IllegalActionError("Perfect Pairs bet must be a non-negative integer");
  }
  if (!Number.isInteger(tpBet) || tpBet < 0) {
    throw new IllegalActionError("21+3 bet must be a non-negative integer");
  }
  if (!Number.isInteger(llBet) || llBet < 0) {
    throw new IllegalActionError("Lucky Ladies bet must be a non-negative integer");
  }

  const { previousShoe } = opts;
  const reuseShoe =
    !!previousShoe &&
    previousShoe.length >= rules.reshuffleAt &&
    (opts.previousVariant ?? "classic") === variant;
  const shuffled = !reuseShoe;

  // Side bets are debited with the deal but paid on the spot, so the main
  // game's staked/payout accounting (and the result banner) excludes them.
  const debit = (bet + ppBet + tpBet + llBet) * seats;
  const state: RoundState = {
    shoe: reuseShoe ? [...previousShoe] : createShoe(rng, rules),
    dealer: [],
    dealerRevealed: false,
    hands: Array.from({ length: seats }, () => newHand([], bet)),
    active: 0,
    phase: "player",
    baseBet: bet,
    insuranceBet: 0,
    splits: 0,
    staked: bet * seats,
    payoutTotal: 0,
    variant,
    runningCount: reuseShoe ? (opts.previousCount ?? 0) : 0,
    bots: BOT_SEATS.slice(0, bots).map((seat) => ({
      name: seat.name,
      cards: [],
      bet: seat.bet,
      doubled: false,
      done: false,
      outcome: null,
    })),
  };

  // Casino deal order: one card to each seat (player then bots), dealer up,
  // second card around the table, dealer hole (the only invisible card)
  for (const hand of state.hands) hand.cards.push(draw(state));
  for (const b of state.bots) b.cards.push(draw(state));
  state.dealer.push(draw(state));
  for (const hand of state.hands) hand.cards.push(draw(state));
  for (const b of state.bots) b.cards.push(draw(state));
  state.dealer.push(draw(state, false));

  // Naturals are locked in — they don't take actions
  for (const hand of state.hands) {
    if (isBlackjack(hand)) hand.done = true;
  }
  for (const b of state.bots) {
    if (handValue(b.cards).total === 21) b.done = true;
  }

  const upcard = state.dealer[0];

  // Perfect Pairs resolves right at the deal: the seat's own first two cards
  // as a pair — perfect (same rank + suit) > colored (same color) > mixed
  if (ppBet > 0) {
    const isRed = (s: Suit) => s === "H" || s === "D";
    for (const hand of state.hands) {
      const [c1, c2] = hand.cards;
      let mult = 0;
      let label = "no pair";
      if (c1.rank === c2.rank) {
        if (c1.suit === c2.suit) {
          mult = rules.ppPerfect;
          label = "perfect pair";
        } else if (isRed(c1.suit) === isRed(c2.suit)) {
          mult = rules.ppColored;
          label = "colored pair";
        } else {
          mult = rules.ppMixed;
          label = "mixed pair";
        }
      }
      hand.pp = {
        bet: ppBet,
        payout: mult > 0 ? ppBet + ppBet * mult : 0,
        label,
      };
    }
  }

  // 21+3 also resolves at the deal: first two cards + the upcard as a
  // three-card poker hand
  if (tpBet > 0) {
    for (const hand of state.hands) {
      const { mult, label } = evaluate21Plus3(
        [hand.cards[0], hand.cards[1], upcard],
        rules
      );
      hand.tp = {
        bet: tpBet,
        payout: mult > 0 ? tpBet + tpBet * mult : 0,
        label,
      };
    }
  }

  // Lucky Ladies also resolves at the deal: first two cards totaling 20.
  // The QoH-pair jackpot tier waits for settle (dealer blackjack is not
  // public yet during an insurance phase).
  if (llBet > 0) {
    for (const hand of state.hands) {
      const { mult, label, queens } = evaluateLuckyLadies(
        [hand.cards[0], hand.cards[1]],
        rules
      );
      hand.ll = {
        bet: llBet,
        payout: mult > 0 ? llBet + llBet * mult : 0,
        label,
      };
      if (queens) hand.llQueens = true;
    }
  }

  const sideBetPayout = state.hands.reduce(
    (sum, h) => sum + (h.pp?.payout ?? 0) + (h.tp?.payout ?? 0) + (h.ll?.payout ?? 0),
    0
  );

  if (upcard.rank === "A") {
    // Insurance (or even money, when holding blackjack) comes before the peek
    state.phase = "insurance";
    state.insuranceBet = null;
    return { state, debit, shuffled, sideBetPayout };
  }

  if (cardValue(upcard) === 10 && dealerHasBlackjack(state.dealer)) {
    // Dealer peeks on ten and has it — round over immediately
    return { state: settle(state), debit, shuffled, sideBetPayout };
  }

  // advance() settles right away when every hand is a natural
  return { state: advance(state), debit, shuffled, sideBetPayout };
}

/**
 * 21+3 three-card poker evaluation: the seat's first two cards + the dealer
 * upcard. Precedence: suited trips > straight flush > trips > straight >
 * flush. Aces play high or low in straights (A-2-3 and Q-K-A both count).
 */
export function evaluate21Plus3(
  cards: [Card, Card, Card],
  rules: Rules
): { mult: number; label: string } {
  const suited = cards.every((c) => c.suit === cards[0].suit);
  const trips = cards.every((c) => c.rank === cards[0].rank);
  const idx = cards.map((c) => RANKS.indexOf(c.rank)).sort((a, b) => a - b);
  const straight =
    (idx[1] === idx[0] + 1 && idx[2] === idx[1] + 1) ||
    (idx[0] === 0 && idx[1] === 11 && idx[2] === 12); // Q-K-A (ace high)

  if (trips && suited) return { mult: rules.tpSuitedTrips, label: "suited trips" };
  if (straight && suited) return { mult: rules.tpStraightFlush, label: "straight flush" };
  if (trips) return { mult: rules.tpTrips, label: "three of a kind" };
  if (straight) return { mult: rules.tpStraight, label: "straight" };
  if (suited) return { mult: rules.tpFlush, label: "flush" };
  return { mult: 0, label: "no hand" };
}

/**
 * Lucky Ladies evaluation: the seat's first two cards totaling 20.
 * Precedence: Queen of Hearts pair > matched 20 (identical cards) >
 * suited 20 > any 20. Returns `queens` so the caller can flag jackpot
 * eligibility (QoH pair + dealer blackjack).
 */
export function evaluateLuckyLadies(
  cards: [Card, Card],
  rules: Rules
): { mult: number; label: string; queens: boolean } {
  const [c1, c2] = cards;
  if (handValue([c1, c2]).total !== 20) return { mult: 0, label: "no 20", queens: false };
  const queens = c1.rank === "Q" && c2.rank === "Q" && c1.suit === "H" && c2.suit === "H";
  if (queens) return { mult: rules.llQueenOfHearts, label: "queen of hearts pair", queens };
  if (c1.rank === c2.rank && c1.suit === c2.suit)
    return { mult: rules.llMatched20, label: "matched 20", queens };
  if (c1.suit === c2.suit) return { mult: rules.llSuited20, label: "suited 20", queens };
  return { mult: rules.llAny20, label: "any 20", queens };
}

/** Even money is offered when every hand is a natural and the dealer shows an ace. */
export function evenMoneyOffered(state: RoundState): boolean {
  return (
    state.phase === "insurance" &&
    state.dealer[0]?.rank === "A" &&
    state.hands.every((h) => isBlackjack(h))
  );
}

/** Apply a player action. Returns the new state + any additional chips to debit. */
export function applyAction(state: RoundState, action: PlayerAction): ActionResult {
  normalizeState(state);
  if (state.phase === "settled") {
    throw new IllegalActionError("Round is already settled");
  }

  if (action === "even-money-yes" || action === "even-money-no") {
    if (!evenMoneyOffered(state)) {
      throw new IllegalActionError("Even money is not being offered");
    }
    if (action === "even-money-no") {
      // Play it out: identical to declining insurance (peek, push vs 3:2)
      return resolveInsurance(state, false);
    }
    // Take the guaranteed 1:1 — pre-mark every hand; settle() pays bet × 2
    const s = cloneState(state);
    s.insuranceBet = 0;
    for (const hand of s.hands) hand.outcome = "even-money";
    s.phase = "player";
    return { state: advance(s), debit: 0 };
  }

  if (action === "insurance-yes" || action === "insurance-no") {
    return resolveInsurance(state, action === "insurance-yes");
  }

  if (state.phase !== "player") {
    throw new IllegalActionError("Insurance decision pending");
  }

  const s = cloneState(state);
  const hand = s.hands[s.active];

  switch (action) {
    case "hit": {
      if (hand.done) throw new IllegalActionError("Hand is already finished");
      if (hand.splitAces) throw new IllegalActionError("Split aces receive only one card");
      hand.cards.push(draw(s));
      const { total } = handValue(hand.cards);
      if (total >= 21) hand.done = true;
      return { state: advance(s), debit: 0 };
    }

    case "stand": {
      if (hand.done) throw new IllegalActionError("Hand is already finished");
      hand.done = true;
      return { state: advance(s), debit: 0 };
    }

    case "double": {
      if (hand.done) throw new IllegalActionError("Hand is already finished");
      if (hand.cards.length !== 2) {
        throw new IllegalActionError("Double is only allowed on the first two cards");
      }
      if (hand.splitAces) throw new IllegalActionError("Cannot double split aces");
      const extra = hand.bet;
      hand.bet += extra;
      hand.doubled = true;
      s.staked += extra;
      hand.cards.push(draw(s));
      hand.done = true;
      return { state: advance(s), debit: extra };
    }

    case "split": {
      if (hand.done) throw new IllegalActionError("Hand is already finished");
      if (!canSplit(s, s.active)) throw new IllegalActionError("Hand cannot be split");
      const extra = hand.bet;
      const [c1, c2] = hand.cards;
      const aces = c1.rank === "A";

      hand.cards = [c1, draw(s)];
      hand.fromSplit = true;
      hand.splitAces = aces;

      const second = newHand([c2, draw(s)], extra, true, aces);
      s.hands.splice(s.active + 1, 0, second);
      s.splits += 1;
      s.staked += extra;

      if (aces) {
        // One card each, both hands are done
        hand.done = true;
        second.done = true;
      } else {
        // 21 after split auto-stands (not blackjack)
        if (handValue(hand.cards).total === 21) hand.done = true;
        if (handValue(second.cards).total === 21) second.done = true;
      }

      return { state: advance(s), debit: extra };
    }

    case "surrender": {
      if (hand.done) throw new IllegalActionError("Hand is already finished");
      if (!canSurrender(s, s.active)) {
        throw new IllegalActionError("Surrender is not allowed");
      }
      hand.done = true;
      hand.outcome = "surrender"; // pre-marked; settle() pays half the bet
      return { state: advance(s), debit: 0 };
    }

    default:
      throw new IllegalActionError(`Unknown action: ${action satisfies never}`);
  }
}

/** Late surrender: Spanish 21 only, first two cards, not split or doubled. */
export function canSurrender(state: RoundState, handIndex: number): boolean {
  const hand = state.hands[handIndex];
  return (
    rulesFor(state.variant ?? "classic").lateSurrender &&
    hand.cards.length === 2 &&
    !hand.fromSplit &&
    !hand.doubled &&
    !hand.done
  );
}

/** Insurance covers every seat: half the base bet per initial hand. */
export function stateInsuranceCost(state: RoundState): number {
  // Only meaningful during the insurance phase, before any split can have
  // changed the hand count.
  return insuranceCost(state.baseBet) * state.hands.length;
}

function resolveInsurance(state: RoundState, take: boolean): ActionResult {
  if (state.phase !== "insurance") {
    throw new IllegalActionError("Insurance is not being offered");
  }

  const s = cloneState(state);
  const cost = take ? stateInsuranceCost(s) : 0;
  s.insuranceBet = cost;
  s.staked += cost;

  // Dealer now peeks at the hole card
  if (dealerHasBlackjack(s.dealer)) {
    return { state: settle(s), debit: cost };
  }

  // No dealer blackjack — insurance (if taken) is lost, play continues.
  // Naturals were already locked at the deal; settle if nothing is left to play.
  s.phase = "player";
  return { state: advance(s), debit: cost };
}

export function canSplit(state: RoundState, handIndex: number): boolean {
  const hand = state.hands[handIndex];
  return (
    hand.cards.length === 2 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    !hand.splitAces &&
    state.splits < 2
  );
}

export function canDouble(state: RoundState, handIndex: number): boolean {
  const hand = state.hands[handIndex];
  return hand.cards.length === 2 && !hand.done && !hand.splitAces;
}

/** Move to the next unfinished hand, or play out the dealer and settle. */
function advance(state: RoundState): RoundState {
  const next = state.hands.findIndex((h) => !h.done);
  if (next !== -1) {
    state.active = next;
    return state;
  }
  return settle(state);
}

/**
 * Spanish 21 bonus for an undoubled 21: returns the payout multiplier and a
 * label for the UI, or null when no bonus applies.
 */
function spanish21Bonus(cards: Card[]): { mult: number; label: string } | null {
  const ranks = cards.map((c) => c.rank);
  const suits = new Set(cards.map((c) => c.suit));
  const suited = suits.size === 1;
  const spades = suited && cards[0].suit === "S";

  if (cards.length === 3) {
    const sorted = [...ranks].sort().join(",");
    const is678 = sorted === "6,7,8";
    const is777 = sorted === "7,7,7";
    if (is678 || is777) {
      const combo = is777 ? "7-7-7" : "6-7-8";
      if (spades) return { mult: 3, label: `${combo} Spades` };
      if (suited) return { mult: 2, label: `${combo} Suited` };
      return { mult: 1.5, label: combo };
    }
  }
  if (cards.length >= 7) return { mult: 3, label: `${cards.length}-Card 21` };
  if (cards.length === 6) return { mult: 2, label: "6-Card 21" };
  if (cards.length === 5) return { mult: 1.5, label: "5-Card 21" };
  return null;
}

/**
 * Deterministic basic strategy for the simulated players — hit/stand/double
 * only. Runs before the dealer draws; consumes real shoe cards.
 */
function playBots(state: RoundState): void {
  const up = cardValue(state.dealer[0]);
  for (const bot of state.bots) {
    if (bot.done) continue; // natural 21 at the deal
    for (;;) {
      const { total, soft } = handValue(bot.cards);
      if (total >= 21) break;
      if (soft) {
        if (total >= 18) break;
        bot.cards.push(draw(state));
        continue;
      }
      if (total >= 17) break;
      if (total >= 13 && up >= 2 && up <= 6) break;
      if (total === 12 && up >= 4 && up <= 6) break;
      if ((total === 10 || total === 11) && bot.cards.length === 2 && up <= 9) {
        bot.cards.push(draw(state));
        bot.doubled = true;
        bot.bet *= 2; // cosmetic
        break;
      }
      bot.cards.push(draw(state));
    }
    bot.done = true;
  }
}

/** Settle one hand (player or bot) against the dealer under the table rules. */
function settleHand(
  hand: { cards: Card[]; bet: number; doubled: boolean; fromSplit?: boolean },
  dealerBJ: boolean,
  dealerTotal: number,
  rules: Rules
): { outcome: Outcome; payout: number; bonus?: string } {
  const { total } = handValue(hand.cards);
  const natural = isBlackjack({ cards: hand.cards, fromSplit: hand.fromSplit ?? false });

  if (total > 21) return { outcome: "lose", payout: 0 };

  if (natural) {
    if (dealerBJ && !rules.player21AlwaysWins) {
      return { outcome: "push", payout: hand.bet };
    }
    return { outcome: "blackjack", payout: blackjackPayout(hand.bet) };
  }

  // Spanish 21: any player 21 always wins, with bonus payouts when undoubled
  if (rules.player21AlwaysWins && total === 21) {
    const bonus = rules.bonus21 && !hand.doubled ? spanish21Bonus(hand.cards) : null;
    const mult = bonus?.mult ?? 1;
    return {
      outcome: "win",
      payout: hand.bet + Math.floor(hand.bet * mult),
      ...(bonus ? { bonus: bonus.label } : {}),
    };
  }

  if (dealerBJ) return { outcome: "lose", payout: 0 };
  if (dealerTotal > 21 || total > dealerTotal) return { outcome: "win", payout: hand.bet * 2 };
  if (total === dealerTotal) return { outcome: "push", payout: hand.bet };
  return { outcome: "lose", payout: 0 };
}

/** Reveal the hole card, draw out the dealer if needed, and pay every hand. */
function settle(state: RoundState): RoundState {
  const s = normalizeState(state);
  const rules = rulesFor(s.variant);

  if (!s.dealerRevealed) {
    s.dealerRevealed = true;
    // The hole card enters the count exactly once, at reveal
    s.runningCount += hiLo(s.dealer[1]);
  }

  const dealerBJ = dealerHasBlackjack(s.dealer);

  // Lucky Ladies progressive: Queen of Hearts pair + dealer blackjack.
  // Flagged on the FIRST eligible hand only (one pot, paid once by the API).
  if (dealerBJ) {
    const eligible = s.hands.find((h) => h.llQueens && h.ll);
    if (eligible && !s.hands.some((h) => h.llJackpot)) eligible.llJackpot = true;
  }

  // Bots act after the player, before the dealer (skipped when the peek
  // already ended the round)
  if (!dealerBJ) playBots(s);

  const live = (cards: Card[], surrendered: boolean, natural: boolean) =>
    !surrendered && !natural && !isBust(cards);
  const anyLive =
    s.hands.some((h) => live(h.cards, h.outcome === "surrender", isBlackjack(h))) ||
    s.bots.some((b) => live(b.cards, false, handValue(b.cards).total === 21 && b.cards.length === 2));

  // Dealer only draws when someone at the table is still standing
  if (!dealerBJ && anyLive) {
    for (;;) {
      const { total } = handValue(s.dealer);
      if (total >= 17) break; // stands on soft 17
      s.dealer.push(draw(s));
    }
  }

  const dealerTotal = handValue(s.dealer).total;

  for (const hand of s.hands) {
    if (hand.outcome === "surrender") {
      hand.payout = Math.floor(hand.bet / 2);
      continue;
    }
    if (hand.outcome === "even-money") {
      hand.payout = hand.bet * 2; // guaranteed 1:1, dealer blackjack or not
      continue;
    }
    const r = settleHand(hand, dealerBJ, dealerTotal, rules);
    hand.outcome = r.outcome;
    hand.payout = r.payout;
    if (r.bonus) hand.bonus = r.bonus;
  }

  // Bot outcomes are display-only — no chips move
  for (const bot of s.bots) {
    bot.outcome = settleHand(
      { cards: bot.cards, bet: bot.bet, doubled: bot.doubled },
      dealerBJ,
      dealerTotal,
      rules
    ).outcome;
  }

  // Perfect Pairs and 21+3 were paid on the spot at the deal — NOT counted here.
  // (mtd = legacy pre-0.6.0 in-flight rounds, still settled the old way.)
  s.payoutTotal = s.hands.reduce(
    (sum, h) => sum + h.payout + (h.mtd?.payout ?? 0),
    0
  );

  // Insurance pays 2:1 when the dealer has blackjack
  if (dealerBJ && s.insuranceBet && s.insuranceBet > 0) {
    s.payoutTotal += s.insuranceBet * 3;
  }

  s.phase = "settled";
  s.active = -1;
  return s;
}

export function netResult(state: RoundState): number {
  if (state.phase !== "settled") throw new Error("Round not settled");
  return state.payoutTotal - state.staked;
}

function cloneState(state: RoundState): RoundState {
  return structuredClone(state);
}

// ---------------------------------------------------------------------------
// Client view — what's safe to send over the wire. Never includes the shoe,
// and hides the dealer hole card until reveal.
// ---------------------------------------------------------------------------

export interface ClientHand {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  total: number;
  soft: boolean;
  outcome: Outcome | null;
  payout: number;
  /** Spanish 21 bonus label when one paid (e.g. "5-Card 21"). */
  bonus?: string;
  /** Perfect Pairs side bet result (resolved at the deal). */
  pp?: SideBetResult;
  /** 21+3 side bet result (resolved at the deal). */
  tp?: SideBetResult;
  /** Lucky Ladies side bet result (resolved at the deal). */
  ll?: SideBetResult;
  /** This hand hit the Lucky Ladies progressive jackpot at settle. */
  llJackpot?: boolean;
}

export interface ClientBotHand {
  name: string;
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  total: number;
  soft: boolean;
  outcome: Outcome | null;
}

export interface ClientView {
  phase: Phase;
  variant: Variant;
  baseBet: number;
  insuranceBet: number | null;
  insuranceCost: number;
  active: number;
  dealer: { cards: (Card | null)[]; total: number | null; revealed: boolean };
  hands: ClientHand[];
  bots: ClientBotHand[];
  /** Legal actions for the active hand (affordability is checked API-side). */
  actions: PlayerAction[];
  staked: number;
  payoutTotal: number;
  netResult: number | null;
  /** Hi-Lo running count of every card seen since the shuffle. */
  runningCount: number;
  /** Cards left in the shoe, in decks (half-deck resolution, min 0.5). */
  decksRemaining: number;
  /** runningCount ÷ decksRemaining, one decimal. */
  trueCount: number;
  /** Basic-strategy recommendation for the active hand (set by the API). */
  hint?: PlayerAction | null;
  /** One-line plain-English reason behind the hint (set by the API). */
  hintReason?: string | null;
}

export function clientView(state: RoundState): ClientView {
  normalizeState(state);
  const revealed = state.dealerRevealed;
  const rules = rulesFor(state.variant);

  const actions: PlayerAction[] = [];
  if (state.phase === "insurance") {
    if (evenMoneyOffered(state)) {
      actions.push("even-money-yes", "even-money-no");
    } else {
      actions.push("insurance-yes", "insurance-no");
    }
  } else if (state.phase === "player") {
    const hand = state.hands[state.active];
    if (!hand.splitAces) actions.push("hit");
    actions.push("stand");
    if (canDouble(state, state.active)) actions.push("double");
    if (canSplit(state, state.active)) actions.push("split");
    if (canSurrender(state, state.active)) actions.push("surrender");
  }

  const runningCount = state.runningCount;
  const decksRemaining = Math.max(
    0.5,
    Math.round((state.shoe.length / rules.cardsPerDeck) * 2) / 2
  );
  const trueCount = Math.round((runningCount / decksRemaining) * 10) / 10;

  return {
    phase: state.phase,
    variant: state.variant,
    baseBet: state.baseBet,
    insuranceBet: state.insuranceBet,
    insuranceCost:
      state.phase === "insurance"
        ? stateInsuranceCost(state)
        : insuranceCost(state.baseBet),
    active: state.active,
    dealer: {
      cards: revealed ? state.dealer : [state.dealer[0], null],
      total: revealed
        ? handValue(state.dealer).total
        : state.dealer.length > 0
          ? cardValue(state.dealer[0])
          : null,
      revealed,
    },
    hands: state.hands.map((h) => {
      const { total, soft } = handValue(h.cards);
      return {
        cards: h.cards,
        bet: h.bet,
        doubled: h.doubled,
        done: h.done,
        fromSplit: h.fromSplit,
        total,
        soft,
        outcome: h.outcome,
        payout: h.payout,
        ...(h.bonus ? { bonus: h.bonus } : {}),
        ...(h.pp ? { pp: h.pp } : {}),
        ...(h.tp ? { tp: h.tp } : {}),
        ...(h.ll ? { ll: h.ll } : {}),
        ...(h.llJackpot ? { llJackpot: true } : {}),
      };
    }),
    bots: state.bots.map((b) => {
      const { total, soft } = handValue(b.cards);
      return {
        name: b.name,
        cards: b.cards,
        bet: b.bet,
        doubled: b.doubled,
        done: b.done,
        total,
        soft,
        outcome: b.outcome,
      };
    }),
    actions,
    staked: state.staked,
    payoutTotal: state.payoutTotal,
    netResult: state.phase === "settled" ? netResult(state) : null,
    runningCount,
    decksRemaining,
    trueCount,
  };
}
