import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";

export const metadata = {
  title: "Tunk Rules — Blackjack Club",
};

export default function TunkRulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="Tunk"
          tagline="The classic rummy hustle — melds, drops, and a purse on the line vs three bots"
        />

        <Section title="The Deal" delay={80}>
          <p>
            Standard 52-card deck, no jokers. Everyone gets <strong>5 cards</strong>; the
            rest form the stock, with one card flipped to start the discard. Aces are
            low only (no wrapping runs) and count as <strong>1</strong>; face cards count
            as <strong>10</strong>.
          </p>
        </Section>

        <Section title="Melds & Deadwood" delay={140}>
          <p>
            A meld is 3 or more cards: a <strong>set</strong> (same rank) or a{" "}
            <strong>run</strong> (same suit, consecutive). Any card not part of a meld is{" "}
            <strong>deadwood</strong> — its value counts against you. The table always
            shows your hand&apos;s optimal split, minimizing your own deadwood.
          </p>
        </Section>

        <Section title="On Your Turn" delay={200}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Draw one card — from the <strong>stock</strong> (blind) or the top of the <strong>discard</strong>.</li>
            <li>Then discard one card back down to 5.</li>
            <li>
              Instead of drawing, you may <strong>Tonk</strong> or <strong>Drop</strong> at
              the start of your turn (see below).
            </li>
          </ul>
        </Section>

        <Section title="Tonk & Dropping" delay={260}>
          <PayTable
            rows={[
              ["Tonk", "your whole hand melds with zero deadwood — instant win, double payout"],
              ["Drop", "call it with any hand; if your deadwood is the lowest at the table, you win the difference"],
              ["Caught", "drop with deadwood that isn't the lowest, and whoever beats you collects double, from you alone"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            If the stock and discard both run dry before anyone drops, it&apos;s a{" "}
            <strong>wash</strong> — the lowest deadwood at the table wins the difference
            from everyone else.
          </p>
        </Section>

        <Section title="The Purse" delay={320}>
          <p>
            Everyone starts with <strong>$120</strong>. Every hand settles in cash —
            winners collect the deadwood difference (×2 stake, ×2 again on a Tonk or a
            caught drop) from the losers. Hands keep dealing until you either{" "}
            <strong>bust at $0</strong> or <strong>cash out at $300</strong>.
          </p>
        </Section>

        <p className="fade-up mt-8 text-center text-xs" style={{ animationDelay: "380ms" }}>
          <Link href="/rules" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            ← all house rules
          </Link>
          <span className="mx-2 text-[var(--cream)]/30">·</span>
          <Link href="/tunk" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            play Tunk →
          </Link>
        </p>
      </main>
    </div>
  );
}
