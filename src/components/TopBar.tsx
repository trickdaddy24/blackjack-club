import Link from "next/link";
import { Dumbbell, HelpCircle, Shield, Spade, LogOut, User } from "lucide-react";
import { auth } from "@/auth";
import { logout } from "@/lib/actions";
import { InviteBell } from "@/components/InviteBell";
import { SpadesInviteBell } from "@/components/SpadesInviteBell";
import { HotSeatWatcher } from "@/components/HotSeatWatcher";
import { VoucherBadge } from "@/components/VoucherBadge";
import { GameMenus, MobileNav, NavDropdown } from "@/components/GameMenu";

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
            {/* Desktop: one dropdown per game category, from lib/games.ts.
                Phone: the whole thing collapses into MobileNav below. Both are
                client components — the earlier CSS-only hover/focus-within
                version was unopenable on iOS (no hover on touch, and Safari
                doesn't focus buttons on tap). */}
            <div className="hidden items-center gap-4 sm:flex">
              <GameMenus />
            </div>
            <MobileNav
              extra={[
                { href: "/gym", label: "Counting Gym" },
                { href: "/leaderboard", label: "Club Leaderboards" },
                { href: "/leaderboard/trilux", label: "Trilux Leaderboard" },
                { href: "/rules", label: "House Rules" },
                { href: "/profile", label: "Profile" },
                // Admin isn't listed here on purpose — its red shield stays
                // visible in the bar at every width, so it'd be a duplicate.
              ]}
            />
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
              className="hidden items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 transition-colors hover:text-[var(--gold-bright)] sm:flex"
              title="Counting Gym — speed-flash Hi-Lo drills"
            >
              <Dumbbell className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Gym</span>
            </Link>
            {/* Leaders is a dropdown for the same reason the games are: the
                Trilux table has its own boards, and a buried in-page link
                made them undiscoverable. */}
            <div className="hidden items-center sm:flex">
              <NavDropdown
                label="Leaders"
                items={[
                  {
                    href: "/leaderboard",
                    label: "Club Leaderboards",
                    blurb: "High Rollers, Today, This Week, Strategy Masters",
                  },
                  {
                    href: "/leaderboard/trilux",
                    label: "Trilux Table",
                    blurb: "All Time, Today, This Week, Biggest Bankroll — Trilux only",
                  },
                ]}
              />
            </div>
            <Link
              href="/rules"
              className="hidden items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 transition-colors hover:text-[var(--gold-bright)] sm:flex"
              title="House rules for every game in the Club"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rules</span>
            </Link>
            <Link
              href="/profile"
              className="hidden items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 transition-colors hover:text-[var(--gold-bright)] sm:flex"
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
