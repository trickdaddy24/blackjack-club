import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { TournamentRoom } from "@/components/TournamentRoom";

export const metadata = {
  title: "Tournament — Blackjack Club",
};

export const dynamic = "force-dynamic";

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/tournaments/${id}`);

  const lobby = await prisma.tournamentLobby.findUnique({ where: { id } });
  if (!lobby) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <TournamentRoom lobbyId={id} />
    </div>
  );
}
