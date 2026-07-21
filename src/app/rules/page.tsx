import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { RulesHeader } from "@/components/rules-ui";

export const metadata = {
  title: "House Rules — Blackjack Club",
};

const GAMES: {
  href: string;
  icon: string;
  name: string;
  tagline: string;
  facts: string[];
}[] = [
  {
    href: "/how-to-play",
    icon: "♠",
    name: "Blackjack",
    tagline: "The main floor — real Vegas rules, side bets, and a progressive jackpot",
    facts: [
      "3:2 blackjack · dealer stands on all 17s · six decks",
      "Perfect Pairs, 21+3, Lucky Ladies progressive, Dealer Bust bet",
      "Spanish 21 table, strategy trainer, card counter, floor promotions",
    ],
  },
  {
    href: "/rules/spades",
    icon: "♠️",
    name: "Spades",
    tagline: "Partnership Spades to 500 — you and North against two crafty bots",
    facts: [
      "13 tricks · bid your contract, or go Nil (±100) / Blind Nil (±200)",
      "Contract ×10, overtricks become bags — 10 bags costs 100",
      "Deuces High variant: all four 2s out-trump the A♠",
    ],
  },
  {
    href: "/rules/roulette",
    icon: "◉",
    name: "Roulette",
    tagline: "European and American wheels with the full inside/outside layout",
    facts: [
      "Straight-up pays 35:1 down to even-money reds and blacks",
      "Single zero (37 pockets) or double zero (38) — your pick",
      "First-four 8:1 on the European table, five-number 6:1 on the American",
    ],
  },
  {
    href: "/rules/wildcard",
    icon: "🃏",
    name: "Wild Card",
    tagline: "The 108-card color-shedding classic against three bots, first to 500",
    facts: [
      "Match the color or the symbol; wilds play on anything",
      "Skips, reverses, +2s, and the mighty Wild +4",
      "Forget to call “last card!” and the deck bites back",
    ],
  },
  {
    href: "/rules/tunk",
    icon: "💵",
    name: "Tunk",
    tagline: "The rummy hustle — meld sets and runs, drop your deadwood, purse on the line",
    facts: [
      "5-card hands, draw from the stock or the discard",
      "Tonk a clean hand for double, or drop and hope you're lowest",
      "Bust at $0, cash out a winner at $300",
    ],
  },
  {
    href: "/rules/dominoes",
    icon: "🁣",
    name: "Dominoes",
    tagline: "Classic Draw Dominoes, double-6 set, heads-up against the bot",
    facts: [
      "7 tiles each, 14 in the boneyard",
      "Match either open end, or draw until you can",
      "Empty your hand to win, or win the block on lower pips",
    ],
  },
];

export default function RulesHubPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="House Rules"
          tagline="Every game in the Club, every rule, every payout — pick a table"
        />
        <div className="mt-8 flex flex-col gap-4">
          {GAMES.map((g, i) => (
            <Link
              key={g.href}
              href={g.href}
              className="fade-up gold-ring block rounded-2xl bg-black/25 px-5 py-4 transition-all hover:bg-black/40 hover:shadow-[0_0_24px_rgba(201,162,39,0.15)]"
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-bold gold-text">
                  <span className="mr-2">{g.icon}</span>
                  {g.name}
                </h2>
                <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--cream)]/40">
                  full rules →
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--cream)]/60">{g.tagline}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-[var(--cream)]/45">
                {g.facts.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
        <p className="fade-up mt-8 text-center text-xs text-[var(--cream)]/40" style={{ animationDelay: "400ms" }}>
          All games are play-money only — no purchases, no payouts, just cards and chips.
        </p>
      </main>
    </div>
  );
}
