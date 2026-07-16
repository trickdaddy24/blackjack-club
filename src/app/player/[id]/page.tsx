import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Coins, Crown, Flame, Layers, Swords, TrendingUp, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { rivalRecords } from "@/lib/rivals";

export const metadata = {
  title: "Player — Blackjack Club",
};

export const dynamic = "force-dynamic";

/** Public (members-only) player card: stats, trophies, titles, rivalry. */
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/player/${id}`);
  if (session.user.id === id) redirect("/profile");

  const player = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      chips: true,
      createdAt: true,
      bestWinStreak: true,
      role: true,
    },
  });
  if (!player || player.role === "banned") notFound();

  const [agg, wins, biggest, trophies, titles, myRivals] = await Promise.all([
    prisma.round.aggregate({
      where: { userId: id, status: "settled" },
      _count: true,
    }),
    prisma.round.count({
      where: { userId: id, status: "settled", netResult: { gt: 0 } },
    }),
    prisma.round.findFirst({
      where: { userId: id, status: "settled", netResult: { gt: 0 } },
      orderBy: { netResult: "desc" },
      select: { netResult: true },
    }),
    prisma.achievement.findMany({
      where: { userId: id },
      select: { slug: true },
    }),
    prisma.boardAward.count({ where: { userId: id } }),
    rivalRecords(session.user.id),
  ]);

  const hands = agg._count;
  const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;
  const unlocked = new Set(trophies.map((t) => t.slug));
  const versus = myRivals.find((r) => r.userId === id) ?? null;

  const stats = [
    { icon: Coins, label: "Chip stack", value: player.chips.toLocaleString() },
    { icon: Layers, label: "Hands played", value: hands.toLocaleString() },
    { icon: TrendingUp, label: "Win rate", value: hands > 0 ? `${winRate}%` : "—" },
    { icon: Trophy, label: "Biggest win", value: biggest ? `+${biggest.netResult.toLocaleString()}` : "—" },
    { icon: Flame, label: "Best streak", value: String(player.bestWinStreak) },
    { icon: Crown, label: "Champion titles", value: String(titles) },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            {player.name ?? "Player"}
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            At the table since{" "}
            {player.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>

        {versus && (
          <div className="fade-up mx-auto mt-6 flex max-w-sm items-center justify-center gap-3 rounded-2xl gold-ring bg-black/30 px-5 py-3" style={{ animationDelay: "80ms" }}>
            <Swords className="h-5 w-5 text-[var(--gold-bright)]" />
            <div className="text-center">
              <div className="font-display text-lg font-bold gold-text tabular-nums">
                {versus.wins} – {versus.losses}
                {versus.pushes > 0 && (
                  <span className="text-sm text-[var(--cream)]/50"> ({versus.pushes} even)</span>
                )}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
                Your head-to-head over {versus.rounds} shared rounds
              </div>
            </div>
          </div>
        )}

        <div className="fade-up mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="gold-ring rounded-xl bg-black/25 px-3 py-5 text-center">
              <Icon className="mx-auto mb-2 h-4 w-4 text-[var(--gold)]/70" />
              <div className="font-display text-xl font-bold gold-text tabular-nums">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">{label}</div>
            </div>
          ))}
        </div>

        <section className="fade-up mt-10" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
            Trophies — {unlocked.size} / {ACHIEVEMENTS.length}
          </h2>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENTS.filter((a) => unlocked.has(a.slug)).map((a) => (
              <span
                key={a.slug}
                className="gold-ring flex items-center gap-1.5 rounded-full bg-[var(--gold)]/10 px-3 py-1.5 text-xs text-[var(--cream)]/85"
                title={a.description}
              >
                {a.emoji} {a.name}
              </span>
            ))}
            {unlocked.size === 0 && (
              <span className="text-sm text-[var(--cream)]/40">The case is still empty.</span>
            )}
          </div>
        </section>

        <p className="fade-up mt-10 text-center text-xs text-[var(--cream)]/40" style={{ animationDelay: "240ms" }}>
          <Link href="/leaderboard" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
            ← Back to the boards
          </Link>
        </p>
      </main>
    </div>
  );
}
