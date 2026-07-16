import { redirect } from "next/navigation";
import { Coins, TrendingUp, Layers, Trophy, Flame } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { ACHIEVEMENTS } from "@/lib/achievements";

export const metadata = {
  title: "Your Record — Blackjack Club",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, agg, wins, biggest, trophies] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        chips: true,
        createdAt: true,
        winStreak: true,
        bestWinStreak: true,
      },
    }),
    prisma.round.aggregate({
      where: { userId: session.user.id, status: "settled" },
      _count: true,
      _sum: { netResult: true },
    }),
    prisma.round.count({
      where: { userId: session.user.id, status: "settled", netResult: { gt: 0 } },
    }),
    prisma.round.findFirst({
      where: { userId: session.user.id, status: "settled", netResult: { gt: 0 } },
      orderBy: { netResult: "desc" },
      select: { netResult: true },
    }),
    prisma.achievement.findMany({
      where: { userId: session.user.id },
      select: { slug: true, unlockedAt: true },
    }),
  ]);

  if (!user) redirect("/login");

  const hands = agg._count;
  const net = agg._sum.netResult ?? 0;
  const winRate = hands > 0 ? Math.round((wins / hands) * 100) : 0;

  const stats = [
    { icon: Coins, label: "Chip stack", value: user.chips.toLocaleString() },
    { icon: Layers, label: "Hands played", value: hands.toLocaleString() },
    { icon: TrendingUp, label: "Win rate", value: hands > 0 ? `${winRate}%` : "—" },
    { icon: Trophy, label: "Biggest win", value: biggest ? `+${biggest.netResult.toLocaleString()}` : "—" },
    {
      icon: Flame,
      label: "Win streak",
      value: hands > 0 ? `${user.winStreak} · best ${user.bestWinStreak}` : "—",
    },
    {
      icon: Trophy,
      label: "Trophies",
      value: `${trophies.length} / ${ACHIEVEMENTS.length}`,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            {user.name ?? "Player"}
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            At the table since{" "}
            {user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            {" · "}
            lifetime {net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString()} chips
          </p>
        </div>

        <div className="fade-up mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="gold-ring rounded-xl bg-black/25 px-3 py-5 text-center">
              <Icon className="mx-auto mb-2 h-4 w-4 text-[var(--gold)]/70" />
              <div className="font-display text-xl font-bold gold-text tabular-nums">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">
                {label}
              </div>
            </div>
          ))}
        </div>

        <TrophyCase unlocked={trophies} />

        <RecentHands userId={session.user.id} />
      </main>
    </div>
  );
}

function TrophyCase({
  unlocked,
}: {
  unlocked: { slug: string; unlockedAt: Date }[];
}) {
  const bySlug = new Map(unlocked.map((t) => [t.slug, t.unlockedAt]));
  return (
    <section className="fade-up mt-10" style={{ animationDelay: "180ms" }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        Trophy Case
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const at = bySlug.get(a.slug);
          return (
            <div
              key={a.slug}
              className={`gold-ring rounded-xl px-3 py-4 text-center ${
                at ? "bg-[var(--gold)]/10" : "bg-black/25 opacity-45 grayscale"
              }`}
              title={a.description}
            >
              <div className="text-2xl leading-none">{a.emoji}</div>
              <div className="mt-2 font-display text-sm font-bold gold-text">{a.name}</div>
              <div className="mt-1 text-[11px] leading-snug text-[var(--cream)]/55">
                {a.description}
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-wider text-[var(--cream)]/40">
                {at
                  ? at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "Locked"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function RecentHands({ userId }: { userId: string }) {
  const rounds = await prisma.round.findMany({
    where: { userId, status: "settled" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, bet: true, netResult: true, createdAt: true },
  });

  if (rounds.length === 0) return null;

  return (
    <section className="fade-up mt-10" style={{ animationDelay: "240ms" }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--cream)]/60">
        Recent Hands
      </h2>
      <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
        {rounds.map((r) => (
          <li key={r.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
            <span className="text-[var(--cream)]/60">
              {r.createdAt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="text-[var(--cream)]/50 tabular-nums">bet {r.bet}</span>
            <span
              className={`w-20 text-right font-semibold tabular-nums ${
                r.netResult > 0
                  ? "text-[var(--gold-bright)]"
                  : r.netResult < 0
                    ? "text-red-300/80"
                    : "text-[var(--cream)]/50"
              }`}
            >
              {r.netResult > 0 ? `+${r.netResult}` : r.netResult}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
