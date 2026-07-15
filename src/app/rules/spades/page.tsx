import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";

export const metadata = {
  title: "Spades Rules — Blackjack Club",
};

export default function SpadesRulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="Spades"
          tagline="Partnership Spades to 500 — you and North vs West and East"
        />

        <Section title="The Table" delay={80}>
          <p>
            Four seats, two teams: <strong>you partner with North</strong>, sitting across
            the table, against West and East (both bots — your partner is a bot too, so
            choose your bids wisely). Each hand deals the full 52-card deck, 13 cards
            each. <strong>Spades are always trump.</strong> First team to{" "}
            <strong>500 points</strong> wins; if both cross 500 on the same hand, the
            higher score takes it (a tie keeps playing).
          </p>
        </Section>

        <Section title="Bidding" delay={140}>
          <p>
            Bidding starts left of the dealer. Each player bids the number of tricks they
            expect to take (their share of the team&apos;s contract):
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Nil</strong> — bid zero, promising to take <em>no tricks at all</em>.
              Worth +100 if you pull it off, −100 if even one trick falls your way.
            </li>
            <li>
              <strong>Blind Nil</strong> — Nil declared <em>before looking at your
              cards</em>. Double stakes: +200 made, −200 failed. For the brave and the
              desperate.
            </li>
            <li>
              A failed Nil&apos;s tricks never help your partner&apos;s contract — but they
              DO count as bags for the team.
            </li>
          </ul>
        </Section>

        <Section title="Playing a Hand" delay={200}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The player left of the dealer leads the first trick; the trick winner leads the next.</li>
            <li><strong>Follow the lead suit if you can.</strong> Void in it? Play anything — including a spade.</li>
            <li>
              <strong>Spades can&apos;t be led until they&apos;re broken</strong> (a spade
              discarded on an earlier trick) — unless spades are all you have left.
            </li>
            <li>
              Highest spade wins the trick; no spade played, highest card of the lead suit
              wins.
            </li>
          </ul>
        </Section>

        <Section title="Scoring" delay={260}>
          <PayTable
            rows={[
              ["Make your team contract", "10 × contract"],
              ["Fall short (“set”)", "−10 × contract"],
              ["Each overtrick", "+1 bag"],
              ["Every 10th bag", "−100"],
              ["Nil made / failed", "+100 / −100"],
              ["Blind Nil made / failed", "+200 / −200"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            Bags roll over — collect your tenth and the 100-point penalty hits, with the
            remainder carrying forward. Sandbagging is a lifestyle, not a strategy.
          </p>
        </Section>

        <Section title="Deuces High Variant" delay={320}>
          <p>
            Flip the top-bar toggle and <strong>all four 2s become trump</strong>, ranked
            above the A♠: <strong>2♠ &gt; 2♥ &gt; 2♣ &gt; 2♦</strong>, then A♠ on down.
            Deuces follow as spades (leading one counts as a spade lead), and the bots
            know exactly what their deuces are worth — you&apos;ve been warned.
          </p>
        </Section>

        <p className="fade-up mt-8 text-center text-xs" style={{ animationDelay: "380ms" }}>
          <Link href="/rules" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            ← all house rules
          </Link>
          <span className="mx-2 text-[var(--cream)]/30">·</span>
          <Link href="/spades" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            play Spades →
          </Link>
        </p>
      </main>
    </div>
  );
}
