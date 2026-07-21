import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";

export const metadata = {
  title: "Dominoes Rules — Blackjack Club",
};

export default function DominoesRulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="Dominoes"
          tagline="Classic Draw Dominoes, double-6 set, heads-up against the bot"
        />

        <Section title="The Set & The Deal" delay={80}>
          <p>
            A standard <strong>double-6 set</strong> — 28 tiles, every unique pair from
            0-0 up to 6-6. Each side deals <strong>7 tiles</strong>; the remaining{" "}
            <strong>14</strong> form the boneyard.
          </p>
        </Section>

        <Section title="The Opening Lead" delay={140}>
          <p>
            Whoever holds the <strong>highest double</strong> leads with it. If neither hand
            has any double at all — entirely possible, only half the set gets dealt — the
            single highest tile across both hands leads instead (6-4 beats 6-3 beats 5-4).
          </p>
        </Section>

        <Section title="Playing" delay={200}>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              The board has two open ends. Play a tile whose number matches{" "}
              <strong>either open end</strong>, extending the line at that end.
            </li>
            <li>
              No legal play? <strong>Draw</strong> from the boneyard until you get one — or,
              if the boneyard is empty, you <strong>pass</strong>.
            </li>
            <li>
              <strong>Two passes in a row</strong> (both sides stuck, boneyard empty) blocks
              the round.
            </li>
            <li>Empty your hand first and you win the round outright.</li>
          </ul>
        </Section>

        <Section title="Scoring a Block" delay={260}>
          <p>
            If the round blocks instead of emptying, whoever is holding{" "}
            <strong>fewer total pips</strong> in their remaining hand wins. Equal pips is a
            tie — nobody scores.
          </p>
          <PayTable
            rows={[
              ["Empty your hand first", "instant win"],
              ["Board blocks — lower pip count", "win"],
              ["Board blocks — equal pip count", "tie"],
            ]}
          />
        </Section>

        <p className="fade-up mt-8 text-center text-xs" style={{ animationDelay: "320ms" }}>
          <Link href="/rules" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            ← all house rules
          </Link>
          <span className="mx-2 text-[var(--cream)]/30">·</span>
          <Link href="/dominoes" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            play Dominoes →
          </Link>
        </p>
      </main>
    </div>
  );
}
