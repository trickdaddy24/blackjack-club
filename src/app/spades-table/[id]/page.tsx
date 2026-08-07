import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seatOfSpades } from "@/lib/spades-table";
import { TopBar } from "@/components/TopBar";
import { SpadesMultiplayerTable } from "@/components/SpadesMultiplayerTable";

export const metadata = {
  title: "Spades Duo — Blackjack Club",
};

export const dynamic = "force-dynamic";

export default async function SpadesTablePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/spades-table/${id}`);

  const table = await prisma.spadesTable.findUnique({ where: { id } });
  if (!table || seatOfSpades(table, session.user.id) === null) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <SpadesMultiplayerTable tableId={id} />
    </div>
  );
}
