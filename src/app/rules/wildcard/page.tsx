import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";

export const metadata = {
  title: "Wild Card Rules — Blackjack Club",
};

export default function WildCardRulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="Wild Card"
          tagline="The 108-card color-shedding classic vs West, North, and East"
        />

        <Section title="The Deck & The Deal" delay={80}>
          <p>
            108 cards in four colors. Per color: one 0, two each of 1–9, and two each of
            Skip, Reverse, and +2 — plus four Wilds and four Wild +4s that belong to no
            color. Everyone starts with <strong>7 cards</strong>; the rest form the draw
            pile with one card flipped to start the discard.
          </p>
        </Section>

        <Section title="Playing" delay={140}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              On your turn, play a card matching the <strong>active color</strong> or the
              top card&apos;s <strong>symbol</strong> (number on number, +2 on +2, Skip on
              Skip…).
            </li>
            <li><strong>Wilds play on anything</strong> and let you name the new color.</li>
            <li>
              Can&apos;t play? <strong>Draw one.</strong> If the drawn card is playable you
              may play it immediately — or keep it and pass.
            </li>
            <li>First player out of cards wins the hand.</li>
          </ul>
        </Section>

        <Section title="Action Cards" delay={200}>
          <PayTable
            rows={[
              ["Skip ⦸", "next player loses their turn"],
              ["Reverse ⇄", "play direction flips"],
              ["+2", "next player draws two and is skipped"],
              ["Wild", "name the color"],
              ["Wild +4", "name the color; next player draws four and is skipped"],
            ]}
          />
        </Section>

        <Section title="“Last Card!”" delay={260}>
          <p>
            Playing down to <strong>one card</strong>? You must declare{" "}
            <strong>&quot;last card!&quot;</strong> with the play — forget, and you
            immediately draw <strong>2 penalty cards</strong>. The bots never forget.
            You will.
          </p>
        </Section>

        <Section title="Scoring" delay={320}>
          <p>
            The hand&apos;s winner collects points for every card still stuck in the other
            three hands:
          </p>
          <PayTable
            rows={[
              ["Number cards", "face value"],
              ["Skip / Reverse / +2", "20 each"],
              ["Wild / Wild +4", "50 each"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            First to <strong>500 points</strong> wins the game. Hands keep dealing (dealer
            rotates) until someone gets there.
          </p>
        </Section>

        <p className="fade-up mt-8 text-center text-xs" style={{ animationDelay: "380ms" }}>
          <Link href="/rules" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            ← all house rules
          </Link>
          <span className="mx-2 text-[var(--cream)]/30">·</span>
          <Link href="/wildcard" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            play Wild Card →
          </Link>
        </p>
      </main>
    </div>
  );
}
