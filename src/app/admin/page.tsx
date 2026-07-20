import Link from "next/link";
import { notFound } from "next/navigation";
import { Users, UserPlus, Ghost, ShieldBan } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { TopBar } from "@/components/TopBar";
import { PlayerActions, PurgePanel } from "@/components/admin-ui";

export const metadata = {
  title: "Pit Boss — Blackjack Club",
};

// Console pages must never be cached or statically built
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const adminId = await requireAdmin();
  if (!adminId) notFound(); // 404, not 403 — the console stays invisible

  const { q } = await searchParams;
  const search = q?.trim() ?? "";
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, recent, zeroPlay, banned, players] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { rounds: { none: {} }, role: "user" } }),
    prisma.user.count({ where: { role: "banned" } }),
    prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        chips: true,
        role: true,
        createdAt: true,
        winStreak: true,
        _count: { select: { rounds: true, achievements: true } },
      },
    }),
  ]);

  const signals = [
    { icon: Users, label: "Players", value: total.toLocaleString() },
    { icon: UserPlus, label: "Joined 24h", value: recent.toLocaleString(), hot: recent >= 20 },
    { icon: Ghost, label: "Never played", value: zeroPlay.toLocaleString(), hot: zeroPlay >= 25 },
    { icon: ShieldBan, label: "Banned", value: banned.toLocaleString() },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Unmissable: this tab is the console, not the casino */}
      <div className="bg-red-900/80 py-1 text-center text-[11px] font-bold uppercase tracking-[0.4em] text-red-100">
        Pit Boss Console
      </div>
      <TopBar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16">
        <div className="fade-up mt-8 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-wide gold-text">Pit Boss</h1>
            <p className="mt-1 text-sm text-[var(--cream)]/50">
              Every action here is audited —{" "}
              <Link href="/admin/audit" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
                view the log
              </Link>
              {" · "}
              <Link href="/admin/rounds" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
                round inspector
              </Link>
              {" · "}
              <Link href="/admin/house" className="text-[var(--gold-bright)] underline-offset-4 hover:underline">
                house
              </Link>
            </p>
          </div>
        </div>

        <div className="fade-up mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: "60ms" }}>
          {signals.map(({ icon: Icon, label, value, hot }) => (
            <div
              key={label}
              className={`gold-ring rounded-xl bg-black/25 px-3 py-4 text-center ${hot ? "!border-red-400/50" : ""}`}
            >
              <Icon className={`mx-auto mb-2 h-4 w-4 ${hot ? "text-red-300" : "text-[var(--gold)]/70"}`} />
              <div className="font-display text-xl font-bold gold-text tabular-nums">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--cream)]/50">{label}</div>
            </div>
          ))}
        </div>

        <div className="fade-up mt-6 gold-ring rounded-xl bg-black/25 px-4 py-3" style={{ animationDelay: "90ms" }}>
          <PurgePanel />
        </div>

        <form className="fade-up mt-6" style={{ animationDelay: "120ms" }}>
          <input
            name="q"
            defaultValue={search}
            placeholder="Search players by name or email…"
            className="w-full rounded-xl border border-[var(--gold)]/25 bg-black/40 px-4 py-2.5 text-sm text-[var(--cream)] placeholder:text-[var(--cream)]/30 focus:outline-none focus:border-[var(--gold)]/60"
            aria-label="Search players"
          />
        </form>

        <ul
          className="fade-up gold-ring mt-4 divide-y divide-[var(--gold)]/10 overflow-hidden rounded-2xl bg-black/25"
          style={{ animationDelay: "150ms" }}
        >
          {players.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-[var(--cream)]/40">No players match.</li>
          )}
          {players.map((p) => (
            <li key={p.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-semibold text-[var(--cream)]/90">
                    <Link
                      href={`/admin/users/${p.id}`}
                      className="underline-offset-4 hover:text-[var(--gold-bright)] hover:underline"
                    >
                      {p.name ?? "Player"}
                    </Link>
                    {p.role !== "user" && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          p.role === "admin"
                            ? "bg-[var(--gold)]/20 text-[var(--gold-bright)]"
                            : "bg-red-900/60 text-red-200"
                        }`}
                      >
                        {p.role}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-[var(--cream)]/45">{p.email}</div>
                </div>
                <div className="text-right text-xs text-[var(--cream)]/50">
                  <div className="font-display text-base font-bold gold-text tabular-nums">
                    {p.chips.toLocaleString()}
                  </div>
                  {p._count.rounds} rounds · 🏆 {p._count.achievements} · streak {p.winStreak}
                  <br />
                  joined{" "}
                  {p.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <PlayerActions userId={p.id} name={p.name ?? "Player"} role={p.role} />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
