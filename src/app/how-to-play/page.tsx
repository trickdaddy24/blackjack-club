import { TopBar } from "@/components/TopBar";
import { PayTable, Section } from "@/components/rules-ui";
import { rulesFor } from "@/lib/blackjack/engine";
import { MINIMUM_SCHEDULE } from "@/lib/tableMinimum";
import { PROMO_SCHEDULE } from "@/lib/promotions";

export const metadata = {
  title: "How to Play — Blackjack Club",
};

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
            How to Play — Blackjack
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            The rules of the table, every side bet, and exactly what they pay ·{" "}
            <a
              href="/rules"
              className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline"
            >
              rules for all Club games →
            </a>
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
            graduation cap). Any mistake gets coached with the correct play and the reason
            behind it — but the <strong>scorecard only counts decisions you make with the
            guide hidden</strong> (lightbulb off, or that hand&apos;s bulb off). Your
            accuracy number means you actually know the book, not that you can follow a
            glowing button. Side bets are never graded — they&apos;re entertainment, and
            the book&apos;s only opinion on them is that they pay for the sign&apos;s neon.
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
            Bonuses are void after doubling — the 21 still wins, at even money. The strategy
            guide at this table is a close simplification of the published Spanish 21 chart.
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

        <Section title="Dealer Bust Bet" delay={372}>
          <p>
            When the dealer's upcard is a <strong>5 or a 6</strong> — their two weakest
            cards — a fire bar appears mid-round: bet that the dealer <strong>busts</strong>,
            paying <strong>1:1</strong>, for <strong>any amount you can cover</strong> (no
            side-bet cap). One bust bet per round, placed any time before the dealer plays.
            While your bust bet rides, the dealer always plays out their hand — even if
            every player hand already busted. Card counters take note: a ten-rich shoe
            makes this bet a lot more interesting.
          </p>
        </Section>

        <Section title="Floor Promotions — Vegas Clock" delay={376}>
          <p className="mb-1 text-[var(--cream)]/55">
            The floor runs promotions on the same Pacific-time clock as the table minimums.
            The promo banner above the table shows what&apos;s live and what&apos;s next:
          </p>
          <PayTable
            rows={PROMO_SCHEDULE.map((p) => [
              `${p.name} (${p.hours})`,
              p.pitch,
            ])}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Happy Hour applies to rounds <em>dealt</em> during the window — a hand dealt at
            6:59pm still pays 2:1 on a natural.
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
              <strong>Chips</strong> — everyone starts with 10,000. Go broke with no round
              in progress and the house stakes you back to 1,000. See{" "}
              <strong>Daily Bonus &amp; VIP</strong> below for the full claim economy.
            </li>
            <li>
              <strong>Multiple hands</strong> — play up to three seats at once, same bet each.
            </li>
          </ul>
        </Section>

        <Section title="Daily Bonus & VIP" delay={460}>
          <p>
            Claim once every 24 hours for a base <strong>+2,500 chips</strong>. Three things
            stack on top of that base:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Login streak</strong> — claiming on consecutive Vegas days adds{" "}
              <strong>+250 per day</strong> past the first, capped at <strong>+1,750</strong>{" "}
              (day 7 and beyond). Miss a day and the streak resets to 1.
            </li>
            <li>
              <strong>VIP tier</strong> — a permanent loyalty status from your{" "}
              <em>lifetime settled rounds</em>, boosting the whole claim by a percentage:
            </li>
          </ul>
          <PayTable
            rows={[
              ["Member (0 rounds)", "+0%"],
              ["Silver (100 rounds)", "+5%, one-time +500"],
              ["Gold (500 rounds)", "+10%, one-time +1,500"],
              ["Platinum (2,000 rounds)", "+20%, one-time +5,000"],
              ["Diamond (5,000 rounds)", "+35%, one-time +15,000"],
              ["Seven Stars (15,000 rounds)", "+50%, one-time +50,000"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Each tier also pays a <strong>one-time bonus</strong> the instant you cross its
            threshold. And if the floor is running{" "}
            <strong>Midnight Madness</strong>, the whole claim — base, streak, and VIP boost
            together — is <strong>doubled</strong>. Stack everything and a single claim can be
            worth up to <strong>12,750 chips</strong>.
          </p>
        </Section>

        <Section title="Chip Wheel" delay={480}>
          <p>
            One free spin every Vegas day. Twenty segments, weighted toward the small end:
          </p>
          <PayTable
            rows={[
              ["150 chips", "30% (6 of 20 segments)"],
              ["300 chips", "25% (5 of 20 segments)"],
              ["450 chips", "20% (4 of 20 segments)"],
              ["750 chips", "15% (3 of 20 segments)"],
              ["1,500 chips", "5% (1 of 20 segments)"],
              ["7,500 chips — JACKPOT", "5% (1 of 20 segments)"],
            ]}
          />
        </Section>

        <Section title="Property-Pick Bonus" delay={500}>
          <p>
            Once per Vegas day, pick one of six properties. Each has its own payout curve —
            the choice is about risk shape, not a strictly-better option (every property
            lands near the same ~850-950 expected value):
          </p>
          <PayTable
            rows={[
              ["Circus Circus", "750–950, always — safe & steady"],
              ["MGM Grand", "500–1,300, always — standard odds, wide range"],
              ["Bellagio", "500–1,100, plus 5% chance of a 2,000 Fountain Show"],
              ["Caesars Palace", "100–1,700, always — the widest spread"],
              ["Wynn", "300–900, plus 5% chance of a 5,000 Penthouse Jackpot"],
              ["The Sphere", "250–1,450, plus 8% chance the roll doubles (Encore)"],
            ]}
          />
        </Section>

        <Section title="Daily Quests" delay={520}>
          <p>Nine quests, all reset on the Vegas day. Complete any of them for chips:</p>
          <PayTable
            rows={[
              ["🃏 Grinder's Shift — settle 5 rounds", "+500"],
              ["🏆 Triple Threat — win 3 rounds", "+750"],
              ["🔥 Back to Back — win 2 rounds in a row", "+750"],
              ["♠️ Snapper — be dealt a blackjack", "+750"],
              ["✨ Little Extra — win any side bet", "+500"],
              ["⚡ Press It — win a hand you doubled", "+750"],
              ["👥 Bring a Friend — settle a round at a shared table", "+1,000"],
              ["🔮 Call the Bust — win a Dealer Bust bet", "+1,000"],
              ["💪 Hit the Gym — complete a counting drill in the Gym", "+500"],
            ]}
          />
        </Section>

        <Section title="Hot Seat Drops" delay={540}>
          <p>
            A random bonus lands on one currently-active player — mid-hand, or settled within
            the last few minutes — roughly every <strong>4 to 12 minutes</strong>, deliberately
            randomized so it can&apos;t be timed. Usually a modest <strong>300–900 chips</strong>
            , with a <strong>5% chance</strong> of a &quot;blaze&quot; hit worth{" "}
            <strong>2,000–3,000 chips</strong>. No action needed — just be at the table when the
            clock lands on you.
          </p>
        </Section>

        <Section title="Match-Play Voucher" delay={560}>
          <p>
            A welcome-back bonus: stay away <strong>6+ hours</strong> since your last settled
            round and your next visit grants a voucher, active for{" "}
            <strong>2 hours</strong>. While it&apos;s active, your next real win on the main
            game <strong>doubles</strong> — capped at a <strong>+10,000</strong> bonus on top
            of the round&apos;s own payout. One grant per Vegas day; side bets don&apos;t
            trigger or consume it.
          </p>
        </Section>
      </main>
    </div>
  );
}
