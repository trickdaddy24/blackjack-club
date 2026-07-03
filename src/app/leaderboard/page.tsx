import { redirect } from "next/navigation";
import { Crown, Medal } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";

export const metadata = {
  title: "Leaderboard — Blackjack Club",
};

const TOP_N = 10;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="font-mono text-sm text-[var(--cream)]/50 tabular-nums">{rank}</span>;
}

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [top, me] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ chips: "desc" }, { createdAt: "asc" }],
      take: TOP_N,
      select: { id: true, name: true, chips: true, createdAt: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, chips: true, createdAt: true },
    }),
  ]);
  if (!me) redirect("/login");

  const inTop = top.some((u) => u.id === userId);
  const myRank = inTop
    ? top.findIndex((u) => u.id === userId) + 1
    : (await prisma.user.count({ where: { chips: { gt: me.chips } } })) + 1;

  const row = (
    u: { id: string; name: string | null; chips: number; createdAt: Date },
    rank: number
  ) => {
    const isMe = u.id === userId;
    return (
      <li
        key={u.id}
        className={`flex items-center gap-4 px-5 py-3 ${
          isMe ? "bg-[var(--gold)]/10 shadow-[inset_2px_0_0_var(--gold)]" : ""
        }`}
      >
        <span className="flex w-8 items-center justify-center">
          <RankBadge rank={rank} />
        </span>
        <span className="flex-1 truncate font-display font-semibold text-[var(--cream)]/90">
          {u.name ?? "Player"}
          {isMe && (
            <span className="ml-2 rounded bg-[var(--gold)]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--gold-bright)]">
              you
            </span>
          )}
        </span>
        <span className="hidden text-xs text-[var(--cream)]/40 sm:block">
          since {u.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </span>
        <span className="font-display text-lg font-bold gold-text tabular-nums">
          {u.chips.toLocaleString()}
        </span>
      </li>
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-[var(--cream)]/50">
            The club&apos;s biggest chip stacks{!inTop && <> · you&apos;re ranked #{myRank}</>}
          </p>
        </div>

        <ul
          className="fade-up gold-ring mt-8 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
          style={{ animationDelay: "120ms" }}
        >
          {top.map((u, i) => row(u, i + 1))}
          {!inTop && (
            <>
              <li className="px-5 py-1.5 text-center text-xs text-[var(--cream)]/30">···</li>
              {row(me, myRank)}
            </>
          )}
        </ul>
      </main>
    </div>
  );
}
