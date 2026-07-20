import Link from "next/link";
import { Dumbbell, HelpCircle, Shield, Spade, LogOut, Trophy, User, Users } from "lucide-react";
import { auth } from "@/auth";
import { logout } from "@/lib/actions";
import { InviteBell } from "@/components/InviteBell";
import { HotSeatWatcher } from "@/components/HotSeatWatcher";
import { VoucherBadge } from "@/components/VoucherBadge";

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
            <Link
              href="/play"
              className="uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
            >
              Table
            </Link>
            <Link
              href="/table"
              className="flex items-center gap-1.5 uppercase tracking-widest text-[var(--cream)]/70 hover:text-[var(--gold-bright)] transition-colors"
              title="Shared table — invite a friend"
            >
              <Users className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Duo</span>
            </Link>
            <InviteBell />
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
