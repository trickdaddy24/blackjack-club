import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/TopBar";
import { CountingGym } from "@/components/CountingGym";
import { GYM_LEVELS } from "@/lib/gym";

export const metadata = {
  title: "Counting Gym — Blackjack Club",
};

export const dynamic = "force-dynamic";

export default async function GymPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/gym");

  const drills = await prisma.gymDrill.findMany({
    where: { userId: session.user.id, submitted: { not: null } },
    select: { level: true, correct: true },
  });
  const total = drills.length;
  const perfect = drills.filter((d) => d.correct).length;
  const levelRank = new Map(GYM_LEVELS.map((l, i) => [l.id, i]));
  const bestIdx = drills
    .filter((d) => d.correct)
    .reduce((best, d) => Math.max(best, levelRank.get(d.level) ?? -1), -1);

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <CountingGym
        stats={{
          total,
          perfect,
          accuracy: total > 0 ? Math.round((perfect / total) * 100) : null,
          bestLevel: bestIdx >= 0 ? GYM_LEVELS[bestIdx].name : null,
        }}
      />
    </div>
  );
}
