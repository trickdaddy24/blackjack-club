// Time-of-day table minimum, mirroring how Las Vegas floors raise and lower
// limits through the day. Anchored on the Strip's clock (Pacific time) so the
// "floor" changes at the same moments for every player worldwide.
//
// $15 is the standard table; mornings run cheap, evenings run hot.

export interface TableMinimum {
  min: number;
  label: string;
}

export function currentTableMinimum(now: Date = new Date()): TableMinimum {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );

  if (hour >= 4 && hour < 12) return { min: 5, label: "morning rates" };
  if (hour >= 12 && hour < 18) return { min: 15, label: "afternoon rates" };
  if (hour >= 18 || hour < 2) return { min: 25, label: "evening rates" };
  return { min: 10, label: "late-night rates" }; // 2am–4am Vegas
}
