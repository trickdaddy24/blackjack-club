// Shared building blocks for the rules pages — one look for every game in
// the Club (used by /how-to-play and everything under /rules).

export function Section({
  title,
  delay,
  children,
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="fade-up mt-8" style={{ animationDelay: `${delay}ms` }}>
      <h2 className="mb-3 font-display text-sm font-bold uppercase tracking-[0.3em] text-[var(--gold-bright)]">
        {title}
      </h2>
      <div className="gold-ring rounded-2xl bg-black/25 px-5 py-4 text-sm leading-relaxed text-[var(--cream)]/75">
        {children}
      </div>
    </section>
  );
}

export function PayTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="mt-2 w-full text-sm">
      <tbody>
        {rows.map(([hand, pays]) => (
          <tr key={hand} className="border-t border-[var(--gold)]/10 first:border-t-0">
            <td className="py-1.5 pr-4 text-[var(--cream)]/70">{hand}</td>
            <td className="py-1.5 text-right font-display font-bold gold-text tabular-nums">
              {pays}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RulesHeader({ title, tagline }: { title: string; tagline: string }) {
  return (
    <div className="fade-up mt-8 text-center">
      <h1 className="font-display text-3xl font-bold tracking-wide gold-text">{title}</h1>
      <p className="mt-1 text-sm text-[var(--cream)]/50">{tagline}</p>
    </div>
  );
}
