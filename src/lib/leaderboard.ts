// Leaderboard time windows, on the same Vegas clock (America/Los_Angeles)
// as the table minimums and floor promotions: "Today" resets at midnight
// Pacific, weeks start Monday midnight Pacific — one crowning moment for
// every player worldwide.

/** Board qualification: settled rounds needed in the window. */
export const MIN_ROUNDS_TO_RANK = 10;
/** Strategy Masters qualification: graded blind decisions needed. */
export const MIN_DECISIONS_TO_RANK = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

function vegasParts(now: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: weekdays.indexOf(get("weekday")),
  };
}

/** The UTC instant of midnight in Las Vegas for the given date's PT day. */
function vegasMidnightUTC(y: number, m: number, d: number): Date {
  // Midnight PT is 07:00 UTC (PDT) or 08:00 UTC (PST) — probe both
  for (const offset of [7, 8]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, offset));
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        hourCycle: "h23",
      }).format(candidate)
    );
    if (hour === 0) return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 8)); // unreachable; PST fallback
}

/** Start of "Today" on the Vegas clock. */
export function vegasDayStart(now: Date = new Date()): Date {
  const { y, m, d } = vegasParts(now);
  return vegasMidnightUTC(y, m, d);
}

/** Start of "This Week" (Monday midnight) on the Vegas clock. */
export function vegasWeekStart(now: Date = new Date()): Date {
  const { weekday } = vegasParts(now);
  const daysSinceMonday = (weekday + 6) % 7; // Mon=0 … Sun=6
  // Step back to Monday via the PT calendar (DST-safe: resolve the PT date
  // of "now minus N days" and take ITS midnight)
  const back = new Date(now.getTime() - daysSinceMonday * DAY_MS);
  const { y, m, d } = vegasParts(back);
  return vegasMidnightUTC(y, m, d);
}

/** Today's Vegas calendar date as a stable key, e.g. "2026-07-16". */
export function vegasDayKey(now: Date = new Date()): string {
  const { y, m, d } = vegasParts(now);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Midnight opening YESTERDAY's Vegas day (the just-closed daily window). */
export function previousVegasDayStart(now: Date = new Date()): Date {
  // 12h before today's midnight is safely inside yesterday, any DST shift
  return vegasDayStart(new Date(vegasDayStart(now).getTime() - DAY_MS / 2));
}

/** Monday midnight opening LAST week (the just-closed weekly window). */
export function previousVegasWeekStart(now: Date = new Date()): Date {
  return vegasWeekStart(new Date(vegasWeekStart(now).getTime() - DAY_MS / 2));
}
