import Link from "next/link";
import { Dumbbell, HelpCircle, Shield, Spade, LogOut, Trophy, User } from "lucide-react";
import { auth } from "@/auth";
import { logout } from "@/lib/actions";
import { InviteBell } from "@/components/InviteBell";
import { SpadesInviteBell } from "@/components/SpadesInviteBell";
import { HotSeatWatcher } from "@/components/HotSeatWatcher";
import { VoucherBadge } from "@/components/VoucherBadge";
import { activeCategories, gamesIn } from "@/lib/games";

export async function TopBar() {
  const session = await auth();

  return (
    <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-3 py-4">
      <Link href="/" className="flex items-center gap-2">
        <Spade className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" />
        <span className="font-display text-lg font-bold tracking-[0.2em] gold-text">
          BLACKJACK CLUB
        </span>
      </Link>

      <nav className="flex items-center gap-4 text-sm">
        {session?.user ? (
          <>
            {/* Grouped by game, from the lib/games.ts registry — so "Trilux"
                reads as a kind of blackjack instead of a mystery word, and the
                nav can absorb new games without growing a flat link per game.
                CSS-only (hover + focus-within) keeps TopBar a server component
                and stays keyboard-reachable. */}
            {activeCategories(true).map((cat) => {
              const entries = gamesIn(cat, true);
              return (
                <div key={cat} className="group relative">
                  <button
                    className="flex items-center gap-1 uppercase tracking-widest text-[var(--cream)]/70 transition-colors group-hover:text-[var(--gold-bright)] group-focus-within:text-[var(--gold-bright)]"
                    aria-haspopup="true"
                  >
                    {cat}
                    <span aria-hidden className="text-[9px] leading-none opacity-60">▾</span>
                  </button>
                  <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                    <div className="gold-ring min-w-52 overflow-hidden rounded-xl bg-[#12100c] py-1 shadow-xl">
                      {entries.map((g) => (
                        <Link
                          key={g.href}
                          href={g.href}
                          title={g.blurb}
                          className="block px-4 py-2 text-xs normal-case tracking-normal text-[var(--cream)]/75 transition-colors hover:bg-[var(--gold)]/15 hover:text-[var(--gold-bright)]"
                        >
                          {g.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <InviteBell />
            <SpadesInviteBell />
            <VoucherBadge />
            {session.user.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 uppercase tracking-widest text-red-300/80 hover:text-red-200 transition-colors"
                title="Pit Boss Console"
              >
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <HotSeatWatcher userId={session.user.id} />
            <Link
              href="/gym"
              className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
              title="Counting Gym — speed-flash Hi-Lo drills"
            >
              <Dumbbell className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Gym</span>
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
              title="Top chip stacks"
            >
              <Trophy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Leaders</span>
            </Link>
            <Link
              href="/rules"
              className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
              title="House rules for every game in the Club"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rules</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              {session.user.name?.split(" ")[0] ?? "Profile"}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/50 hover:text-[var(--gold-bright)] transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/rules"
              className="uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
            >
              Rules
            </Link>
            <Link
              href="/login"
              className="uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
            >
              Sign In
            </Link>
            <Link href="/register" className="action-btn primary !py-2 !px-4 !text-xs">
              Join the Club
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
