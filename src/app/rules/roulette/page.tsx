import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PayTable, RulesHeader, Section } from "@/components/rules-ui";

export const metadata = {
  title: "Roulette Rules — Blackjack Club",
};

export default function RouletteRulesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <RulesHeader
          title="Roulette"
          tagline="Two wheels, the full layout, and every payout the felt prints"
        />

        <Section title="The Wheels" delay={80}>
          <p>
            Pick your poison from the top bar:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>European</strong> — 37 pockets: 1–36 plus a single <strong>0</strong>.
              The friendlier wheel (house edge ~2.7%).
            </li>
            <li>
              <strong>American</strong> — 38 pockets: 1–36 plus <strong>0 and 00</strong>.
              Same payouts, extra zero, bigger house bite (~5.3%). Vegas classic.
            </li>
          </ul>
          <p className="mt-2 text-[var(--cream)]/55">
            Place chips anywhere on the layout — numbers, lines, corners, or the outside
            spots — then spin. Winning bets return the stake plus the payout below; the
            last two dozen spins stay on the history rail.
          </p>
        </Section>

        <Section title="Inside Bets" delay={140}>
          <PayTable
            rows={[
              ["Straight up (one number)", "35:1"],
              ["Split (two adjoining numbers)", "17:1"],
              ["Street (a row of three)", "11:1"],
              ["Corner (four in a square)", "8:1"],
              ["Six line (two rows)", "5:1"],
              ["First four 0-1-2-3 (European)", "8:1"],
              ["Five-number 0-00-1-2-3 (American)", "6:1"],
            ]}
          />
        </Section>

        <Section title="Outside Bets" delay={200}>
          <PayTable
            rows={[
              ["Dozen (1–12 / 13–24 / 25–36)", "2:1"],
              ["Column", "2:1"],
              ["Red / Black", "1:1"],
              ["Even / Odd", "1:1"],
              ["Low 1–18 / High 19–36", "1:1"],
            ]}
          />
          <p className="mt-2 text-[var(--cream)]/55">
            The zeros belong to no outside bet — when 0 (or 00) hits, every red/black,
            even/odd, high/low, dozen, and column wager goes to the house. That&apos;s the
            whole business model.
          </p>
        </Section>

        <Section title="The Bankroll" delay={260}>
          <p>
            The roulette table runs its own play-money bankroll (fresh games start at
            1,000) — it&apos;s separate from your blackjack chip balance, so a bad night at
            the wheel never touches your main stack.
          </p>
        </Section>

        <p className="fade-up mt-8 text-center text-xs" style={{ animationDelay: "320ms" }}>
          <Link href="/rules" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            ← all house rules
          </Link>
          <span className="mx-2 text-[var(--cream)]/30">·</span>
          <Link href="/roulette" className="text-[var(--cream)]/40 underline-offset-2 hover:text-[var(--gold-bright)] hover:underline">
            play Roulette →
          </Link>
        </p>
      </main>
    </div>
  );
}
