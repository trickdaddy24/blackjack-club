import Link from "next/link";
import { Crown, Spade, Heart, Diamond, Club, CircleDot, Layers, Dice5, Banknote, Blocks, Gamepad2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { MIN_ROUNDS_TO_RANK } from "@/lib/leaderboard";

export default async function LobbyPage() {
  const session = await auth();

  // Raw chip stack, but only for players who've actually put in the rounds —
  // otherwise free daily-claim chips alone can out-rank real players.
  const [candidates, roundCounts] = await Promise.all([
    prisma.user.findMany({
      orderBy: { chips: "desc" },
      select: { id: true, name: true, chips: true },
    }),
    prisma.round.groupBy({
      by: ["userId"],
      where: { status: "settled" },
      _count: true,
    }),
  ]);
  const roundsByUser = new Map(roundCounts.map((r) => [r.userId, r._count]));
  const leaders = candidates
    .filter((u) => (roundsByUser.get(u.id) ?? 0) >= MIN_ROUNDS_TO_RANK)
    .slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-4 pb-16">
        {/* hero */}
        <div className="fade-up mt-10 flex flex-col items-center text-center">
          <div className="mb-6 flex gap-3 text-[var(--gold)]/60">
            <Spade className="h-5 w-5" fill="currentColor" />
            <Heart className="h-5 w-5 text-[var(--suit-red)]/70" fill="currentColor" />
            <Diamond className="h-5 w-5 text-[var(--suit-red)]/70" fill="currentColor" />
            <Club className="h-5 w-5" fill="currentColor" />
          </div>
          <h1 className="font-display text-5xl font-black tracking-[0.08em] gold-text sm:text-6xl">
            BLACKJACK
          </h1>
          <p className="font-display mt-1 text-xl tracking-[0.5em] text-[var(--cream)]/60">
            C L U B
          </p>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--cream)]/70">
            Pull up a chair at the midnight table. Real rules — six decks, dealer
            stands on all 17s, blackjack pays 3 to 2. Free chips every day,
            never a dime of real money.
          </p>

          <Link
            href={session?.user ? "/play" : "/register"}
            className="action-btn primary mt-8 !px-12 !py-4 !text-base"
          >
            {session?.user ? "Take Your Seat" : "Join — 10,000 Free Chips"}
          </Link>
          {!session?.user && (
            <Link
              href="/login"
              className="mt-4 text-sm text-[var(--cream)]/50 underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
            >
              Already a member? Sign in
            </Link>
          )}
        </div>

        {/* leaderboard */}
        {leaders.length > 0 && (
          <section className="fade-up mt-16 w-full max-w-md" style={{ animationDelay: "150ms" }}>
            <h2 className="mb-4 flex items-center justify-center gap-2 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
              <Crown className="h-4 w-4 text-[var(--gold-bright)]" />
              High Rollers
            </h2>
            <ol className="gold-ring divide-y divide-[var(--gold)]/15 overflow-hidden rounded-2xl bg-black/30">
              {leaders.map((u, i) => (
                <li key={u.id} className="flex items-center justify-between px-5 py-3">
                  <span className="flex items-center gap-3">
                    <span className="font-display w-5 text-right text-sm font-bold text-[var(--gold)]/70">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[var(--cream)]/85">{u.name ?? "Anonymous"}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums gold-text">
                    {u.chips.toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* house rules */}
        <section className="fade-up mt-14 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "300ms" }}>
          {[
            ["3:2", "Blackjack payout"],
            ["6", "Decks in the shoe"],
            ["S17", "Dealer stands soft 17"],
            ["2:1", "Insurance payout"],
          ].map(([big, small]) => (
            <div key={small} className="gold-ring rounded-xl bg-black/25 px-3 py-4 text-center">
              <div className="font-display text-2xl font-bold gold-text">{big}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
                {small}
              </div>
            </div>
          ))}
        </section>

        {/* Another game at the Club — Spades */}
        <section className="fade-up mt-14 w-full max-w-md" style={{ animationDelay: "450ms" }}>
          <Link
            href="/spades"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Spade className="h-5 w-5" fill="currentColor" /> New — Spades
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              Partnership Spades vs the house. Nil, Blind Nil, bags, to 500. No sign-up —{" "}
              <span className="text-[var(--gold-bright)]">deal me in →</span>
            </p>
          </Link>
        </section>

        {/* Another game at the Club — Roulette */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "550ms" }}>
          <Link
            href="/roulette"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <CircleDot className="h-5 w-5" /> New — Roulette
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              European or American wheel, full betting table, play-money chips. No sign-up —{" "}
              <span className="text-[var(--gold-bright)]">spin the wheel →</span>
            </p>
          </Link>
        </section>

        {/* Another game at the Club — Wild Card */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "650ms" }}>
          <Link
            href="/wildcard"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Layers className="h-5 w-5" /> New — Wild Card
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              The classic color-matching shedding game vs three bots. Skips, reverses, wilds —{" "}
              <span className="text-[var(--gold-bright)]">deal the chaos →</span>
            </p>
          </Link>
        </section>
        {/* Another game at the Club — Dominoes */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "750ms" }}>
          <Link
            href="/dominoes"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Dice5 className="h-5 w-5" /> New — Dominoes
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              Classic Draw Dominoes, heads-up vs the bot. Double-6 set, no sign-up —{" "}
              <span className="text-[var(--gold-bright)]">set the boneyard →</span>
            </p>
          </Link>
        </section>

        {/* Another game at the Club — Tunk */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "850ms" }}>
          <Link
            href="/tunk"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Banknote className="h-5 w-5" /> New — Tunk
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              The rummy hustle — meld sets and runs, Tonk a clean hand, drop your deadwood. No sign-up —{" "}
              <span className="text-[var(--gold-bright)]">buy in →</span>
            </p>
          </Link>
        </section>

        {/* Not a card game — Tetris */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "950ms" }}>
          <Link
            href="/tetris"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Blocks className="h-5 w-5" /> New — Tetris
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              Hold, next queue, ghost piece, 7-bag randomizer. Members only —{" "}
              <span className="text-[var(--gold-bright)]">drop in →</span>
            </p>
          </Link>
        </section>

        {/* Not a card game — Pixel Plumber */}
        <section className="fade-up mt-6 w-full max-w-md" style={{ animationDelay: "1050ms" }}>
          <Link
            href="/mario"
            className="gold-ring block rounded-2xl bg-black/25 px-6 py-5 text-center transition hover:bg-black/40"
          >
            <div className="flex items-center justify-center gap-2 font-display text-lg font-bold gold-text">
              <Gamepad2 className="h-5 w-5" /> New — Pixel Plumber
            </div>
            <p className="mt-1 text-sm text-[var(--cream)]/60">
              A run-and-jump platformer, 3 levels, goombas and coins. Members only —{" "}
              <span className="text-[var(--gold-bright)]">press start →</span>
            </p>
          </Link>
        </section>
      </main>

      <footer className="pb-6 text-center text-xs text-[var(--cream)]/30">
        Play-money only. No purchases, no payouts — just cards.
      </footer>
    </div>
  );
}
