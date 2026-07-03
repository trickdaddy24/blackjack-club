// Time-of-day table minimum, mirroring how Las Vegas floors raise and lower
// limits through the day. Anchored on the Strip's clock (Pacific time) so the
// "floor" changes at the same moments for every player worldwide.
//
// $15 is the standard table; mornings run cheap, evenings run hot.

export interface TableMinimum {
  min: number;
  label: string;
}

export interface MinimumWindow extends TableMinimum {
  /** PT hours, [from, to). Windows crossing midnight are split into two rows. */
  from: number;
  to: number;
  /** Human window for the rules page, e.g. "6pm – 2am". */
  hours: string;
}

/** The full schedule — single source for enforcement and the rules page. */
export const MINIMUM_SCHEDULE: MinimumWindow[] = [
  { from: 4, to: 12, min: 5, label: "morning rates", hours: "4am – noon" },
  { from: 12, to: 18, min: 15, label: "afternoon rates", hours: "noon – 6pm" },
  { from: 18, to: 24, min: 25, label: "evening rates", hours: "6pm – 2am" },
  { from: 0, to: 2, min: 25, label: "evening rates", hours: "6pm – 2am" },
  { from: 2, to: 4, min: 10, label: "late-night rates", hours: "2am – 4am" },
];

export function currentTableMinimum(now: Date = new Date()): TableMinimum {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );

  const window = MINIMUM_SCHEDULE.find((w) => hour >= w.from && hour < w.to);
  // The schedule covers all 24 hours; fall back to the standard table anyway
  return window
    ? { min: window.min, label: window.label }
    : { min: 15, label: "afternoon rates" };
}
