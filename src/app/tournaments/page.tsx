import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { listOpenLobbies, listMyLiveEntries } from "@/lib/tournament-io";
import { TournamentListActions } from "@/components/TournamentListActions";

export const metadata = {
  title: "Tournaments — Blackjack Club",
};

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/tournaments");
  const userId = session.user.id;

  const [lobbies, mine] = await Promise.all([listOpenLobbies(), listMyLiveEntries(userId)]);

  const creatorIds = [...new Set(lobbies.map((l) => l.creatorId))];
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(creators.map((u) => [u.id, u.name ?? "A club member"]));

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            Tournaments
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--cream)]/60">
            Sit-and-go, 3–8 players. Buy in for 1,000 chips, play 20 solo hands at your own
            pace against the dealer with an isolated stack — no side bets. Top 2 stacks split
            the pool, 60/40.
          </p>
          <div className="mt-6">
            <TournamentListActions />
          </div>
        </div>

        {mine.length > 0 && (
          <div className="fade-up mt-8" style={{ animationDelay: "60ms" }}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--cream)]/50">
              Your tournaments
            </h2>
            <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
              {mine.map((m) => (
                <li key={m.lobbyId}>
                  <a
                    href={`/tournaments/${m.lobbyId}`}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[var(--gold)]/5"
                  >
                    <span className="text-[var(--cream)]/80">
                      {m.lobbyStatus === "open" ? "Waiting to start" : "In progress"}
                    </span>
                    <span className="font-mono font-bold gold-text tabular-nums">
                      {m.stack.toLocaleString()} · {m.handsPlayed}/20
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="fade-up mt-8" style={{ animationDelay: "120ms" }}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--cream)]/50">
            Open lobbies
          </h2>
          <ul className="gold-ring divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25">
            {lobbies.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">
                No open lobbies right now — start one above.
              </li>
            )}
            {lobbies.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--cream)]/90">
                    {nameOf.get(l.creatorId) ?? "A club member"}&apos;s tournament
                  </p>
                  <p className="text-xs text-[var(--cream)]/50">
                    {l.entrantCount}/{l.maxEntrants} joined · {l.buyIn.toLocaleString()} buy-in
                  </p>
                </div>
                <a href={`/tournaments/${l.id}`} className="action-btn shrink-0 !px-4 !py-2 !text-[11px]">
                  View
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
