// Duo-table quick reactions.
//
// Rides the table's existing ~1.5s poll rather than adding a socket: an emote
// is written to the table row and read back by whoever polls next, so there is
// no new transport, no new connection to keep alive, and it works identically
// for the host and the guest.
//
// Emotes are deliberately ephemeral. They live in a small ring buffer on the
// table row and expire on read, which means no cleanup job and no way for a
// long session to accumulate thousands of rows. A fixed catalog (no free
// text) keeps this from becoming an unmoderated chat channel between two
// accounts that may not know each other well — the invite system lets you
// play with a stranger.

export interface EmoteDef {
  slug: string;
  emoji: string;
  label: string;
}

export const EMOTES: EmoteDef[] = [
  { slug: "nice", emoji: "👏", label: "Nice hand" },
  { slug: "wow", emoji: "😲", label: "Wow" },
  { slug: "gg", emoji: "🤝", label: "Good game" },
  { slug: "lucky", emoji: "🍀", label: "Lucky!" },
  { slug: "ouch", emoji: "😬", label: "Ouch" },
  { slug: "fire", emoji: "🔥", label: "On fire" },
  { slug: "think", emoji: "🤔", label: "Thinking…" },
  { slug: "cheers", emoji: "🥂", label: "Cheers" },
];

const BY_SLUG = new Map(EMOTES.map((e) => [e.slug, e]));
export const emoteDef = (slug: string) => BY_SLUG.get(slug);
export const isEmote = (slug: unknown): slug is string =>
  typeof slug === "string" && BY_SLUG.has(slug);

/** How long a reaction stays visible. Long enough to notice across a 1.5s poll. */
export const EMOTE_TTL_MS = 12_000;
/** Ring-buffer cap — a spammer can never grow the row unbounded. */
export const MAX_EMOTES = 8;
/** Per-seat cooldown, so the bar can't be machine-gunned. */
export const EMOTE_COOLDOWN_MS = 2_000;

export interface EmoteRecord {
  seat: number;
  slug: string;
  /** Epoch ms. */
  at: number;
}

export function parseEmotes(json: string | null | undefined): EmoteRecord[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is EmoteRecord =>
        r && typeof r.at === "number" && typeof r.seat === "number" && isEmote(r.slug)
    );
  } catch {
    return [];   // a corrupt column must never break the table
  }
}

/** Drop expired entries. Pure, so the TTL is testable without a clock. */
export function liveEmotes(list: EmoteRecord[], now: number): EmoteRecord[] {
  return list.filter((e) => now - e.at < EMOTE_TTL_MS);
}

/** Most recent emote from this seat, or null. */
export function lastFromSeat(list: EmoteRecord[], seat: number): EmoteRecord | null {
  let best: EmoteRecord | null = null;
  for (const e of list) if (e.seat === seat && (!best || e.at > best.at)) best = e;
  return best;
}

export function onCooldown(list: EmoteRecord[], seat: number, now: number): boolean {
  const last = lastFromSeat(list, seat);
  return Boolean(last && now - last.at < EMOTE_COOLDOWN_MS);
}

/**
 * Append one reaction, pruning expired entries and capping the buffer.
 * Returns the new list unchanged when the seat is on cooldown, so callers can
 * treat "rejected" and "accepted" identically without a second code path.
 */
export function pushEmote(
  list: EmoteRecord[],
  seat: number,
  slug: string,
  now: number
): EmoteRecord[] {
  if (!isEmote(slug)) return list;
  const live = liveEmotes(list, now);
  if (onCooldown(live, seat, now)) return live;
  return [...live, { seat, slug, at: now }].slice(-MAX_EMOTES);
}

export function serializeEmotes(list: EmoteRecord[]): string | null {
  return list.length ? JSON.stringify(list) : null;
}
