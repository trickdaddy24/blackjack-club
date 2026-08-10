// The Club's game directory — one source of truth for the top nav and the
// lobby, so the two can't drift apart as games are added.
//
// Naming rule this fixes: the nav used to read "Table / Trilux / Duo", where
// all three are blackjack and none of them said so. Every entry now carries
// the GAME it belongs to and the MODE within that game, and the nav groups by
// game — so "Trilux" reads as a kind of blackjack rather than a mystery word.
//
// Adding a game is one entry here. See GitHub #15.

export type GameCategory = "Blackjack" | "Cards" | "Board" | "Puzzle" | "Arcade";

export interface GameEntry {
  /** Route. Also the React key. */
  href: string;
  /** Label inside its group, e.g. "Trilux" under Blackjack. */
  label: string;
  /** Group heading — the game itself. */
  category: GameCategory;
  /** One line for the lobby card and the nav tooltip. */
  blurb: string;
  /** Login required. Every game is gated today (see #16); kept explicit so a
   *  future no-sign-up funnel game is a data change, not a code change. */
  gated: boolean;
  /** Show in the top nav. Everything shows in the lobby. */
  inNav?: boolean;
}

export const GAMES: GameEntry[] = [
  // ---- Blackjack: four modes of the same game, previously named as if they
  // were unrelated products.
  {
    href: "/play",
    label: "Classic",
    category: "Blackjack",
    blurb: "The main table — six decks, blackjack pays 3 to 2, dealer stands on all 17s.",
    gated: true,
    inNav: true,
  },
  {
    href: "/play/trilux",
    label: "Trilux",
    category: "Blackjack",
    blurb:
      "Burgundy felt with its own bankroll — Match the Dealer, Trilux Bonus and the Super4 progressive.",
    gated: true,
    inNav: true,
  },
  {
    href: "/table",
    label: "Duo",
    category: "Blackjack",
    blurb: "Share a table with a friend — same shoe, own chips, own side bets.",
    gated: true,
    inNav: true,
  },
  {
    href: "/tournaments",
    label: "Tournaments",
    category: "Blackjack",
    blurb: "Sit-and-go, 3–8 players, isolated stacks and a prize pool.",
    gated: true,
    inNav: true,
  },

  // ---- Other card games
  {
    href: "/spades",
    label: "Spades",
    category: "Cards",
    blurb: "Partnership Spades against three bots. Deuces high and Jokers variants.",
    gated: true,
    inNav: true,
  },
  {
    href: "/spades-table",
    label: "Spades Duo",
    category: "Cards",
    blurb: "Partnership Spades — you and a friend against two bots.",
    gated: true,
    inNav: true,
  },
  {
    href: "/tunk",
    label: "Tunk",
    category: "Cards",
    blurb: "Draw-and-discard rummy, heads-up against the bot.",
    gated: true,
  },
  {
    href: "/wildcard",
    label: "Wild Card",
    category: "Cards",
    blurb: "Shedding game with wilds and stacking draws.",
    gated: true,
  },

  // ---- Casino floor
  {
    href: "/roulette",
    label: "Roulette",
    category: "Board",
    blurb: "European or American wheel, full betting table.",
    gated: true,
  },
  {
    href: "/dominoes",
    label: "Dominoes",
    category: "Board",
    blurb: "Basic Draw Dominoes, double-6 set, heads-up against the bot.",
    gated: true,
  },

  // ---- Arcade
  {
    href: "/tetris",
    label: "Tetris",
    category: "Arcade",
    blurb: "The block-stacker, with a high-score chase.",
    gated: true,
  },
  {
    href: "/mario",
    label: "Pixel Plumber",
    category: "Arcade",
    blurb: "Side-scrolling platformer.",
    gated: true,
  },
];

/** Display order for grouped rendering — Blackjack leads, it's the house game. */
export const CATEGORY_ORDER: GameCategory[] = [
  "Blackjack",
  "Cards",
  "Board",
  "Puzzle",
  "Arcade",
];

/** Games in one category, registry order preserved. */
export function gamesIn(category: GameCategory, navOnly = false): GameEntry[] {
  return GAMES.filter((g) => g.category === category && (!navOnly || g.inNav));
}

/** Categories that actually have entries, in display order. */
export function activeCategories(navOnly = false): GameCategory[] {
  return CATEGORY_ORDER.filter((c) => gamesIn(c, navOnly).length > 0);
}
