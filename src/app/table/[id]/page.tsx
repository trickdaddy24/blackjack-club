import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seatOf } from "@/lib/table";
import { TopBar } from "@/components/TopBar";
import { MultiplayerTable } from "@/components/MultiplayerTable";

export const metadata = {
  title: "Duo Table — Blackjack Club",
};

export const dynamic = "force-dynamic";

export default async function TablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/table/${id}`);

  const table = await prisma.table.findUnique({ where: { id } });
  if (!table || seatOf(table, session.user.id) === null) notFound();
  if (table.status === "ended") redirect("/table");

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MultiplayerTable tableId={id} />
    </div>
  );
}
