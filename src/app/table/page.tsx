import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMemberTable } from "@/lib/table";
import { TopBar } from "@/components/TopBar";
import { OpenTableButton } from "@/components/MultiplayerTable";

export const metadata = {
  title: "Duo Table — Blackjack Club",
};

export const dynamic = "force-dynamic";

/** Launcher: returns you to your table, or opens a fresh one. */
export default async function TableLauncherPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/table");

  const table = await getMemberTable(session.user.id);
  if (table) redirect(`/table/${table.id}`);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pb-16">
        <div className="fade-up mt-16 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">
            Duo Table
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--cream)]/60">
            Open a shared table and deal in a friend. Same shoe, own chips, own
            side bets — invites hold the seat for 5 minutes. You run the table:
            invite, kick, end.
          </p>
          <div className="mt-8">
            <OpenTableButton />
          </div>
          <p className="mt-6 text-xs text-[var(--cream)]/40">
            Insurance isn&apos;t offered at shared tables, and the Dealer Bust bet
            stays a solo game. Everything else — 21+3, Perfect Pairs, Lucky
            Ladies and the progressive — plays exactly like your own table.
          </p>
        </div>
      </main>
    </div>
  );
}
