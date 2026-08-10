import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";
import { rulesFor } from "@/lib/blackjack/engine";
import { MAX_SIDE_BET, SUPER4_JACKPOT_SEED } from "@/lib/game";

export const metadata = {
  title: "Trilux Table Rules — Blackjack Club",
};

export default function TriluxRulesPage() {
  // Paytables render straight from the engine, so this page can't drift from
  // what the table actually pays.
  const rules = rulesFor("classic");

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="The Trilux Table"
          tagline="Burgundy felt, its own bankroll, and three side bets you won't find at the main table"
        />

        <Section title="What's Different" delay={80}>
          <p>
            The Trilux table deals <strong>the same blackjack</strong> as the main floor —
            six decks, blackjack pays 3 to 2, dealer stands on all 17s, insurance at 2:1.
            Everything below is what changes when you sit down there:
          </p>
          <ul className="mt-2 space-y-1 text-[var(--cream)]/70">
            <li>
              · <strong>Different side bets.</strong> Match the Dealer, Trilux Bonus and
              Super4 replace Perfect Pairs and 21+3. Lucky Ladies rides at both tables.
            </li>
            <li>
              · <strong>Its own chip bankroll</strong>, separate from your main stack.
            </li>
            <li>
              · <strong>Its own daily bonus, chip wheel and property pick</strong> — claiming
              at one table doesn&apos;t use up the other&apos;s.
            </li>
            <li>
              · <strong>Classic rules only.</strong> Spanish 21 is a main-table game.
            </li>
          </ul>
        </Section>

        <Section title="Your Trilux Bankroll" delay={140}>
          <p>
            The Trilux table has a <strong>separate chip balance</strong>. It starts at zero
            and is funded by moving chips across from your main stack with the{" "}
            <strong>Chips</strong> button above the felt — nothing carries over automatically.
            Win at Trilux and the winnings stay in the Trilux bankroll; lose and only that
            bankroll shrinks.
          </p>
          <p className="mt-2">
            You can move chips <strong>either direction, any time you&apos;re not mid-hand</strong>.
            Your net worth for High Rollers and VIP counts <strong>both wallets together</strong>,
            so moving money between them never costs you rank.
          </p>
          <p className="mt-2 text-[var(--cream)]/55">
            Run dry at Trilux and there&apos;s no house stake — the rescue chips are a
            main-table courtesy. Move more across instead.
          </p>
        </Section>

        <Section title="Match the Dealer — Side Bet" delay={200}>
          <p>
            Optional side bet placed before the deal ($1 minimum, ${MAX_SIDE_BET} maximum,
            applies to each hand you play). It wins when{" "}
            <strong>either of your first two cards matches the dealer&apos;s upcard by
            rank</strong> — paid instantly at the deal, win or lose the main hand.{" "}
            <strong>Both cards can match, and both pay</strong>:
          </p>
          <PayTable
            rows={[
              ["One unsuited match", `${rules.mtdUnsuited}:1`],
              ["One suited match (same suit too)", `${rules.mtdSuited}:1`],
              ["Two matches", "Both are paid, added together"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Two unsuited matches pay {rules.mtdUnsuited * 2}:1; a suited and an unsuited pay{" "}
            {rules.mtdSuited + rules.mtdUnsuited}:1.
          </p>
        </Section>

        <Section title="Trilux Bonus — Side Bet" delay={260}>
          <p>
            Optional side bet placed before the deal ($1 minimum, ${MAX_SIDE_BET} maximum,
            per hand). Your <strong>first two cards plus the dealer&apos;s upcard</strong>{" "}
            form a three-card poker hand — paid instantly at the deal. Unlike 21+3 on the main
            floor, every winning hand pays <strong>the same flat price</strong>, and anything
            below a flush pays nothing:
          </p>
          <PayTable
            rows={[
              ["Flush (three of one suit)", `${rules.tbFlush}:1`],
              ["Straight", `${rules.tbStraight}:1`],
              ["Three of a kind", `${rules.tbTrips}:1`],
              ["Straight flush", `${rules.tbStraightFlush}:1`],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Aces play high or low in straights (A-2-3 and Q-K-A both count), but a straight
            doesn&apos;t wrap around the corner — K-A-2 is nothing.
          </p>
        </Section>

        <Section title="Super4 — Side Bet with a Progressive Jackpot" delay={320}>
          <p>
            Optional side bet placed before the deal ($1 minimum, ${MAX_SIDE_BET} maximum,
            per hand). Super4 ignores your cards entirely and pays on{" "}
            <strong>the dealer&apos;s own hand</strong> — resolved at the deal:
          </p>
          <PayTable
            rows={[
              ["Dealer blackjack, suited in diamonds", "PROGRESSIVE JACKPOT"],
              ["Dealer blackjack, suited any other suit", `+${rules.s4OtherSuitPay} chips`],
              ["Dealer blackjack, same colour", `+${rules.s4SameColorPay} chips`],
              ["Dealer blackjack, mixed colours", `+${rules.s4NoHandPay} chips`],
              ["Dealer shows an ace, no blackjack", `+${rules.s4AceUpPay} chips`],
            ]}
          />
          <p className="mt-2">
            Every Super4 stake feeds the pot, which is shown live on the table sign and
            reseeds at {SUPER4_JACKPOT_SEED.toLocaleString()} chips after a hit. Note these
            are <strong>flat chip amounts, not odds</strong> — the payout is the same whether
            you bet $1 or ${MAX_SIDE_BET}, so there&apos;s no reason to bet big on it.
          </p>
          <p className="mt-2 text-[var(--cream)]/55">
            A dealer blackjack is bad news for your main hand — Super4 is the consolation.
          </p>
        </Section>

        <Section title="Lucky Ladies — Also at This Table" delay={365}>
          <p>
            Lucky Ladies plays at Trilux exactly as it does on the main floor: your first two
            cards totalling 20, paid at the deal, with a Queen of Hearts pair alongside a
            dealer blackjack taking the whole progressive pot. Both tables feed{" "}
            <strong>the same site-wide Lucky Ladies jackpot</strong>.
          </p>
          <PayTable
            rows={[
              ["Any 20", `${rules.llAny20}:1`],
              ["Suited 20", `${rules.llSuited20}:1`],
              ["Matched 20 (identical cards)", `${rules.llMatched20}:1`],
              ["Queen of Hearts pair (Q♥ Q♥)", `${rules.llQueenOfHearts}:1`],
              ["Q♥ pair + dealer blackjack", "PROGRESSIVE JACKPOT"],
            ]}
          />
        </Section>

        <Section title="Daily Claims" delay={400}>
          <p>
            The daily bonus, chip wheel and Vegas property pick are{" "}
            <strong>per table</strong>. Claim them at the main table and they land in your
            main stack; claim them at Trilux and they land in your Trilux bankroll. Each
            table has its own once-a-day allowance, so you can take both.
          </p>
          <p className="mt-2 text-[var(--cream)]/55">
            Your login streak is still counted once per day across the whole club — playing
            both tables doesn&apos;t grow it any faster.
          </p>
        </Section>

        <div className="fade-up mt-8 text-center" style={{ animationDelay: "460ms" }}>
          <Link
            href="/how-to-play"
            className="text-sm text-[var(--cream)]/50 underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
          >
            ← Main table rules, payouts and side bets
          </Link>
        </div>
      </main>
    </div>
  );
}
