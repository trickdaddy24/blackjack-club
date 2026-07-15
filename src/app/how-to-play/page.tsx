import { TopBar } from "@/components/TopBar";
import { rulesFor } from "@/lib/blackjack/engine";
import { MINIMUM_SCHEDULE } from "@/lib/tableMinimum";

export const metadata = {
  title: "How to Play — Blackjack Club",
};

function Section({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="fade-up mt-8" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--gold-bright)]">
        {title}
      </h2>
      <div className="gold-ring rounded-2xl bg-black/25 px-5 py-4 text-sm leading-relaxed text-[var(--cream)]/75">
        {children}
      </div>
    </section>
  );
}

function PayTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {rows.map(([hand, pays]) => (
          <tr key={hand} className="border-t border-[var(--gold)]/10 first:border-t-0">
            <td className="py-1.5 pr-4 text-[var(--cream)]/70">{hand}</td>
            <td className="py-1.5 text-right font-display font-bold gold-text tabular-nums">
              {pays}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HowToPlayPage() {
  const rules = rulesFor("classic");
  // De-dupe the split midnight window for display
  const schedule = MINIMUM_SCHEDULE.filter(
    (w, i, all) => all.findIndex((x) => x.hours === w.hours) === i
  );

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            How to Play
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            The rules of the table, every side bet, and exactly what they pay
          </p>
        </div>

        <Section title="The Goal" delay={80}>
          <p>
            Beat the dealer: get a hand total closer to 21 than the dealer without going
            over. Cards 2–10 count face value, <strong>J / Q / K count 10</strong>, and an{" "}
            <strong>Ace counts 11 or 1</strong> — whichever helps you. A two-card 21
            (Ace + ten-value card) is a <strong>blackjack</strong>, the best hand in the game.
          </p>
        </Section>

        <Section title="Playing a Hand" delay={140}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong>Hit</strong> — take another card. Bust past 21 and the hand is lost.</li>
            <li><strong>Stand</strong> — keep what you have; the dealer plays next.</li>
            <li>
              <strong>Double</strong> — double your bet on your first two cards (also after a
              split), take exactly one more card.
            </li>
            <li>
              <strong>Split</strong> — equal ranks become two hands with a second equal bet.
              One re-split allowed; split aces get one card each.
            </li>
            <li>
              <strong>Surrender</strong> <em>(Spanish 21 only)</em> — give up your first two
              cards and get half your bet back.
            </li>
            <li>
              <strong>Insurance</strong> — offered when the dealer shows an ace. Costs half
              your bet, pays 2:1 if the dealer has blackjack. (Basic strategy says: never
              take it.)
            </li>
            <li>
              <strong>Even money</strong> — if YOU have blackjack and the dealer shows an
              ace, you can lock in a guaranteed 1:1 payout on the spot instead of risking a
              push for the 3:2. (Basic strategy says: play it out.)
            </li>
          </ul>
          <p className="mt-3 text-[var(--cream)]/55">
            💡 Not sure what to do? Turn on the <strong>lightbulb toggle</strong> in the game
            HUD and the mathematically correct play glows gold on every decision — with a
            one-line explanation of <em>why</em> it&apos;s right.
          </p>
          <p className="mt-2 text-[var(--cream)]/55">
            🎓 Want to actually learn it? Turn on the <strong>trainer toggle</strong> (the
            graduation cap) and every play you make is graded against basic strategy — the
            scorecard tracks your accuracy and streak, and any mistake gets coached with the
            correct play and the reason behind it. Run it with hints off for the real test.
          </p>
        </Section>

        <Section title="Payouts — Classic" delay={200}>
          <p className="mb-1 text-[var(--cream)]/55">
            Six-deck shoe · dealer stands on all 17s · dealer peeks for blackjack.
          </p>
          <PayTable
            rows={[
              ["Win against the dealer", "1:1"],
              ["Blackjack (two-card 21)", "3:2"],
              ["Push (tie)", "bet returned"],
              ["Insurance (dealer blackjack)", "2:1"],
            ]}
          />
        </Section>

        <Section title="Spanish 21" delay={260}>
          <p>
            Same table, spicier deck: all four <strong>10s are removed</strong> (48-card
            decks — J/Q/K stay). In exchange, <strong>your 21 and your blackjack always
            win</strong>, even against a dealer 21, you get <strong>late surrender</strong>,
            and multi-card 21s pay bonuses:
          </p>
          <PayTable
            rows={[
              ["5-card 21", "3:2"],
              ["6-card 21", "2:1"],
              ["7+ card 21", "3:1"],
              ["6-7-8 or 7-7-7, mixed suits", "3:2"],
              ["6-7-8 or 7-7-7, same suit", "2:1"],
              ["6-7-8 or 7-7-7, all spades", "3:1"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Bonuses are void after doubling — the 21 still wins, at even money.
          </p>
        </Section>

        <Section title="Perfect Pairs — Side Bet" delay={320}>
          <p>
            Optional side bet placed before the deal ($1 minimum, $100 maximum, applies to
            each hand you play). It wins when <strong>your own first two cards are a
            pair</strong> — <strong>paid instantly at the deal</strong>, win or lose the
            main hand, and you keep playing:
          </p>
          <PayTable
            rows={[
              ["Mixed pair (two colors, e.g. K♥ K♠)", `${rules.ppMixed}:1`],
              ["Colored pair (same color, e.g. K♥ K♦)", `${rules.ppColored}:1`],
              ["Perfect pair (identical card, e.g. K♥ K♥)", `${rules.ppPerfect}:1`],
            ]}
          />
        </Section>

        <Section title="21+3 — Side Bet" delay={350}>
          <p>
            Optional side bet placed before the deal ($1 minimum, $100 maximum, applies to
            each hand you play). Your <strong>first two cards plus the dealer&apos;s
            upcard</strong> form a three-card poker hand — <strong>paid instantly at the
            deal</strong>, win or lose the main hand. Aces play high or low in straights:
          </p>
          <PayTable
            rows={[
              ["Flush (three of one suit)", `${rules.tpFlush}:1`],
              ["Straight (e.g. 9-10-J, A-2-3, Q-K-A)", `${rules.tpStraight}:1`],
              ["Three of a kind", `${rules.tpTrips}:1`],
              ["Straight flush", `${rules.tpStraightFlush}:1`],
              ["Suited three of a kind (identical cards)", `${rules.tpSuitedTrips}:1`],
            ]}
          />
        </Section>

        <Section title="Lucky Ladies — Side Bet with a Progressive Jackpot" delay={365}>
          <p>
            Optional side bet placed before the deal ($1 minimum, $100 maximum, applies to
            each hand you play). It wins when <strong>your first two cards total 20</strong> —
            paid instantly at the deal. Every Lucky Ladies stake feeds the site-wide{" "}
            <strong>progressive jackpot</strong> (shown live on the table sign), and a{" "}
            <strong>Queen of Hearts pair while the dealer has blackjack wins the entire
            pot</strong>:
          </p>
          <PayTable
            rows={[
              ["Any 20", `${rules.llAny20}:1`],
              ["Suited 20 (same suit)", `${rules.llSuited20}:1`],
              ["Matched 20 (identical cards)", `${rules.llMatched20}:1`],
              ["Queen of Hearts pair (Q♥ Q♥)", `${rules.llQueenOfHearts}:1`],
              ["Q♥ pair + dealer blackjack", "PROGRESSIVE JACKPOT"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            The pot reseeds after every jackpot hit. One pot, one winner — with multiple
            hands, the first Queen of Hearts pair takes it.
          </p>
        </Section>

        <Section title="Table Minimums — Vegas Clock" delay={380}>
          <p className="mb-1 text-[var(--cream)]/55">
            Like the Strip, the table minimum changes through the day — on Las Vegas time
            (Pacific). The current floor is always shown above the chips.
          </p>
          <PayTable rows={schedule.map((w) => [`${w.hours} (${w.label})`, `${w.min} chips`])} />
        </Section>

        <Section title="Around the Table" delay={440}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Bots</strong> — seat up to three simulated players (Vinny, Ruth, Doc).
              They're dealt real cards from the shoe and play basic strategy, but never touch
              your chips.
            </li>
            <li>
              <strong>Card counter</strong> — the eye toggle shows the Hi-Lo count: 2–6 count
              +1, 7–9 count 0, 10s and aces count −1. The true count divides by decks
              remaining. Bots' cards count too — great for practice.
            </li>
            <li>
              <strong>Shuffle</strong> — the shoe holds six decks and is riffled fresh when
              about 75% has been dealt (you&apos;ll see and hear it).
            </li>
            <li>
              <strong>Tips</strong> — winners tip. Tip buttons appear after every hand, and
              your lifetime tip total is shown next to the dealer.
            </li>
            <li>
              <strong>Chips</strong> — everyone starts with 10,000. Claim +2,500 daily, and
              if you ever go broke the house stakes you back to 1,000.
            </li>
            <li>
              <strong>Multiple hands</strong> — play up to three seats at once, same bet each.
            </li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
