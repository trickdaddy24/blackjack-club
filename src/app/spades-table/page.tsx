import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getMemberSpadesTable } from "@/lib/spades-table";
import { TopBar } from "@/components/TopBar";
import { OpenSpadesTableButton } from "@/components/SpadesMultiplayerTable";

export const metadata = {
  title: "Spades Duo — Blackjack Club",
};

export const dynamic = "force-dynamic";

/** Launcher: returns you to your Spades table, or opens a fresh one. */
export default async function SpadesTableLauncherPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/spades-table");

  const table = await getMemberSpadesTable(session.user.id);
  if (table) redirect(`/spades-table/${table.id}`);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 pb-16">
        <div className="fade-up mt-16 text-center">
          <h1 className="font-display text-3xl font-bold tracking-wide gold-text">Spades Duo</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--cream)]/60">
            Deal in a friend and play partnership Spades to 500 — you two vs two bots. Fixed
            seats, no lobby: the instant your partner accepts, the first hand is dealt.
          </p>
          <div className="mt-8">
            <OpenSpadesTableButton />
          </div>
          <p className="mt-6 text-xs text-[var(--cream)]/40">
            Same real Spades engine as the single-player{" "}
            <a href="/spades" className="underline hover:text-[var(--gold-bright)]">
              /spades
            </a>{" "}
            table — Nil, Blind Nil, bags. Only your own hand is ever visible to you.
          </p>
        </div>
      </main>
    </div>
  );
}
