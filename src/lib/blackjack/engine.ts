// Pure blackjack rules engine — no framework, no I/O, fully deterministic
// given a shoe. All money amounts are integer chips.
//
// House rules:
//   - 6-deck shoe, reshuffled when fewer than 25% of cards remain
//   - Blackjack pays 3:2, dealer peeks on ace/ten (US rules)
//   - Dealer stands on soft 17
//   - Double on any first two cards, including after split
//   - Split equal ranks, one re-split allowed (max 3 hands)
//   - Split aces receive exactly one card each; 21 after split is not blackjack
//   - Insurance offered on dealer ace, pays 2:1

export type Suit = "S" | "H" | "D" | "C";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Outcome = "blackjack" | "win" | "push" | "lose";

export interface HandState {
  cards: Card[];
  bet: number;
  doubled: boolean;
  done: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  outcome: Outcome | null;
  payout: number;
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
}

export type PlayerAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "insurance-yes"
  | "insurance-no";

/** Result of applying an action: new state + chips to debit immediately. */
export interface ActionResult {
  state: RoundState;
  debit: number;
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

export function createShoe(rng: Rng = defaultRng): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < SHOE_DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
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

function draw(state: RoundState): Card {
  const card = state.shoe.pop();
  if (!card) throw new Error("Shoe exhausted"); // 6 decks: unreachable in a legal round
  return card;
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

/**
 * Start a round. `debit` = the initial bet (caller must have already
 * verified the player can afford it). Reuses `previousShoe` when it still
 * has enough penetration left, otherwise builds a fresh shoe.
 */
export function startRound(
  bet: number,
  previousShoe?: Card[] | null,
  rng: Rng = defaultRng
): ActionResult {
  if (!Number.isInteger(bet) || bet <= 0) {
    throw new IllegalActionError("Bet must be a positive integer");
  }

  const shoe =
    previousShoe && previousShoe.length >= RESHUFFLE_AT
      ? [...previousShoe]
      : createShoe(rng);

  const state: RoundState = {
    shoe,
    dealer: [],
    dealerRevealed: false,
    hands: [newHand([], bet)],
    active: 0,
    phase: "player",
    baseBet: bet,
    insuranceBet: 0,
    splits: 0,
    staked: bet,
    payoutTotal: 0,
  };

  // Deal order: player, dealer up, player, dealer hole
  state.hands[0].cards.push(draw(state));
  state.dealer.push(draw(state));
  state.hands[0].cards.push(draw(state));
  state.dealer.push(draw(state));

  const upcard = state.dealer[0];

  if (upcard.rank === "A") {
    // Insurance decision comes before the peek
    state.phase = "insurance";
    state.insuranceBet = null;
    return { state, debit: bet };
  }

  if (cardValue(upcard) === 10 && dealerHasBlackjack(state.dealer)) {
    // Dealer peeks on ten and has it — round over immediately
    return { state: settle(state), debit: bet };
  }

  if (isBlackjack(state.hands[0])) {
    return { state: settle(state), debit: bet };
  }

  return { state, debit: bet };
}

/** Apply a player action. Returns the new state + any additional chips to debit. */
export function applyAction(state: RoundState, action: PlayerAction): ActionResult {
  if (state.phase === "settled") {
    throw new IllegalActionError("Round is already settled");
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

    default:
      throw new IllegalActionError(`Unknown action: ${action satisfies never}`);
  }
}

function resolveInsurance(state: RoundState, take: boolean): ActionResult {
  if (state.phase !== "insurance") {
    throw new IllegalActionError("Insurance is not being offered");
  }

  const s = cloneState(state);
  const cost = take ? insuranceCost(s.baseBet) : 0;
  s.insuranceBet = cost;
  s.staked += cost;

  // Dealer now peeks at the hole card
  if (dealerHasBlackjack(s.dealer)) {
    return { state: settle(s), debit: cost };
  }

  // No dealer blackjack — insurance (if taken) is lost, play continues
  if (isBlackjack(s.hands[0])) {
    return { state: settle(s), debit: cost };
  }

  s.phase = "player";
  return { state: s, debit: cost };
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

/** Reveal the hole card, draw out the dealer if needed, and pay every hand. */
function settle(state: RoundState): RoundState {
  const s = state;
  s.dealerRevealed = true;

  const dealerBJ = dealerHasBlackjack(s.dealer);
  const allBusted = s.hands.every((h) => isBust(h.cards));
  const allNaturals = s.hands.every((h) => isBlackjack(h));

  // Dealer only draws when there is something left to beat
  if (!dealerBJ && !allBusted && !allNaturals) {
    for (;;) {
      const { total } = handValue(s.dealer);
      if (total >= 17) break; // stands on soft 17
      s.dealer.push(draw(s));
    }
  }

  const dealerTotal = handValue(s.dealer).total;
  const dealerBust = dealerTotal > 21;

  for (const hand of s.hands) {
    const { total } = handValue(hand.cards);

    if (isBust(hand.cards)) {
      hand.outcome = "lose";
      hand.payout = 0;
    } else if (isBlackjack(hand)) {
      if (dealerBJ) {
        hand.outcome = "push";
        hand.payout = hand.bet;
      } else {
        hand.outcome = "blackjack";
        hand.payout = blackjackPayout(hand.bet);
      }
    } else if (dealerBJ) {
      hand.outcome = "lose";
      hand.payout = 0;
    } else if (dealerBust || total > dealerTotal) {
      hand.outcome = "win";
      hand.payout = hand.bet * 2;
    } else if (total === dealerTotal) {
      hand.outcome = "push";
      hand.payout = hand.bet;
    } else {
      hand.outcome = "lose";
      hand.payout = 0;
    }
  }

  s.payoutTotal = s.hands.reduce((sum, h) => sum + h.payout, 0);

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
}

export interface ClientView {
  phase: Phase;
  baseBet: number;
  insuranceBet: number | null;
  insuranceCost: number;
  active: number;
  dealer: { cards: (Card | null)[]; total: number | null; revealed: boolean };
  hands: ClientHand[];
  /** Legal actions for the active hand (affordability is checked API-side). */
  actions: PlayerAction[];
  staked: number;
  payoutTotal: number;
  netResult: number | null;
}

export function clientView(state: RoundState): ClientView {
  const revealed = state.dealerRevealed;

  const actions: PlayerAction[] = [];
  if (state.phase === "insurance") {
    actions.push("insurance-yes", "insurance-no");
  } else if (state.phase === "player") {
    const hand = state.hands[state.active];
    if (!hand.splitAces) actions.push("hit");
    actions.push("stand");
    if (canDouble(state, state.active)) actions.push("double");
    if (canSplit(state, state.active)) actions.push("split");
  }

  return {
    phase: state.phase,
    baseBet: state.baseBet,
    insuranceBet: state.insuranceBet,
    insuranceCost: insuranceCost(state.baseBet),
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
      };
    }),
    actions,
    staked: state.staked,
    payoutTotal: state.payoutTotal,
    netResult: state.phase === "settled" ? netResult(state) : null,
  };
}
