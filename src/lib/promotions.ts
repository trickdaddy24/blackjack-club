// Rotating floor promotions, run on the same Vegas clock as the table
// minimums (America/Los_Angeles) so every player worldwide sees the same
// promo at the same moment. The schedule is the single source of truth for
// enforcement, the promo banner, and the rules page.

export type PromoId = "happy-hour" | "midnight-madness";

export interface Promotion {
  id: PromoId;
  name: string;
  /** Punchy one-liner for the banner. */
  pitch: string;
  /** Longer description for the rules page. */
  description: string;
  /** PT hours, [from, to). Must not cross midnight (split into two rows if needed). */
  from: number;
  to: number;
  /** Human window for banners and the rules page. */
  hours: string;
}

export const PROMO_SCHEDULE: Promotion[] = [
  {
    id: "happy-hour",
    name: "Happy Hour",
    pitch: "BLACKJACK PAYS 2:1",
    description:
      "Every natural blackjack dealt during Happy Hour pays 2:1 instead of 3:2 — the best two hours on the floor.",
    from: 17,
    to: 19,
    hours: "5pm – 7pm",
  },
  {
    id: "midnight-madness",
    name: "Midnight Madness",
    pitch: "DAILY BONUS PAYS DOUBLE",
    description:
      "Claim your daily bonus between midnight and 2am and the house doubles it — 5,000 chips instead of 2,500.",
    from: 0,
    to: 2,
    hours: "midnight – 2am",
  },
];

function vegasHourMinute(now: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get("hour"), minute: get("minute") };
}

/** The promotion running right now, or null when the floor is quiet. */
export function currentPromo(now: Date = new Date()): Promotion | null {
  const { hour } = vegasHourMinute(now);
  return PROMO_SCHEDULE.find((p) => hour >= p.from && hour < p.to) ?? null;
}

export interface PromoOverrideRecord {
  promoId: string | null;
  expiresAt: Date | null;
}

/**
 * The promo that actually governs payouts right now: an unexpired pit-boss
 * override wins, otherwise the schedule. Pure so it's cheap to unit-test —
 * callers fetch the override row themselves and pass it in.
 */
export function effectivePromo(
  override: PromoOverrideRecord | null,
  now: Date = new Date()
): Promotion | null {
  if (override?.promoId && override.expiresAt && override.expiresAt.getTime() > now.getTime()) {
    return PROMO_SCHEDULE.find((p) => p.id === override.promoId) ?? currentPromo(now);
  }
  return currentPromo(now);
}

export interface PromoStatus {
  /** Active promo, or null. */
  active: Promotion | null;
  /** Minutes until the active promo ends (when active). */
  endsInMinutes: number | null;
  /** The next promo on the clock (always set — the schedule wraps daily). */
  next: Promotion;
  /** Minutes until the next promo starts (when none is active). */
  startsInMinutes: number | null;
}

/** Everything the promo banner needs: what's on, what's next, and when. */
export function promoStatus(now: Date = new Date()): PromoStatus {
  const { hour, minute } = vegasHourMinute(now);
  const minutesNow = hour * 60 + minute;
  const active = currentPromo(now);

  if (active) {
    return {
      active,
      endsInMinutes: active.to * 60 - minutesNow,
      next: active,
      startsInMinutes: null,
    };
  }

  // Distance (in minutes, wrapping past midnight) to each promo's start
  let next = PROMO_SCHEDULE[0];
  let best = Infinity;
  for (const p of PROMO_SCHEDULE) {
    const dist = (p.from * 60 - minutesNow + 24 * 60) % (24 * 60);
    if (dist < best) {
      best = dist;
      next = p;
    }
  }
  return { active: null, endsInMinutes: null, next, startsInMinutes: best };
}
