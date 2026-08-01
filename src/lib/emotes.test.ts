import { describe, expect, it } from "vitest";
import {
  EMOTES,
  EMOTE_COOLDOWN_MS,
  EMOTE_TTL_MS,
  MAX_EMOTES,
  emoteDef,
  isEmote,
  lastFromSeat,
  liveEmotes,
  onCooldown,
  parseEmotes,
  pushEmote,
  serializeEmotes,
  type EmoteRecord,
} from "./emotes";

const T = 1_700_000_000_000;
const rec = (seat: number, slug: string, at: number): EmoteRecord => ({ seat, slug, at });

describe("catalog", () => {
  it("has unique slugs and an emoji + label for each", () => {
    expect(new Set(EMOTES.map((e) => e.slug)).size).toBe(EMOTES.length);
    for (const e of EMOTES) {
      expect(e.emoji.length).toBeGreaterThan(0);
      expect(e.label.length).toBeGreaterThan(0);
    }
  });

  it("recognises only catalog slugs", () => {
    expect(isEmote("nice")).toBe(true);
    expect(isEmote("not-a-real-emote")).toBe(false);
    expect(isEmote(42)).toBe(false);
    expect(isEmote(null)).toBe(false);
    expect(emoteDef("gg")?.emoji).toBe("🤝");
  });
});

describe("parseEmotes", () => {
  it("round-trips through serialize", () => {
    const list = [rec(0, "nice", T), rec(1, "wow", T + 10)];
    expect(parseEmotes(serializeEmotes(list))).toEqual(list);
  });

  it("returns empty for null/empty and serializes empty back to null", () => {
    expect(parseEmotes(null)).toEqual([]);
    expect(parseEmotes("")).toEqual([]);
    expect(serializeEmotes([])).toBeNull();
  });

  // A corrupt column must never take the table down.
  it("survives malformed JSON and non-array payloads", () => {
    expect(parseEmotes("{not json")).toEqual([]);
    expect(parseEmotes('{"a":1}')).toEqual([]);
    expect(parseEmotes("null")).toEqual([]);
  });

  it("drops entries that aren't well-formed or aren't in the catalog", () => {
    const json = JSON.stringify([
      rec(0, "nice", T),
      { seat: 0, slug: "chat-injection", at: T },
      { seat: "x", slug: "wow", at: T },
      { seat: 1, slug: "wow" },
      null,
    ]);
    expect(parseEmotes(json)).toEqual([rec(0, "nice", T)]);
  });
});

describe("liveEmotes", () => {
  it("keeps fresh entries and drops expired ones", () => {
    const list = [rec(0, "nice", T), rec(1, "wow", T - EMOTE_TTL_MS - 1)];
    expect(liveEmotes(list, T)).toEqual([rec(0, "nice", T)]);
  });

  it("treats exactly-TTL as expired", () => {
    expect(liveEmotes([rec(0, "nice", T - EMOTE_TTL_MS)], T)).toEqual([]);
  });
});

describe("cooldown", () => {
  it("blocks a second emote from the same seat inside the window", () => {
    const list = [rec(0, "nice", T)];
    expect(onCooldown(list, 0, T + EMOTE_COOLDOWN_MS - 1)).toBe(true);
    expect(onCooldown(list, 0, T + EMOTE_COOLDOWN_MS)).toBe(false);
  });

  it("does not block the other seat", () => {
    expect(onCooldown([rec(0, "nice", T)], 1, T + 100)).toBe(false);
  });

  it("finds the most recent entry for a seat regardless of order", () => {
    const list = [rec(0, "nice", T), rec(0, "wow", T + 500), rec(1, "gg", T + 900)];
    expect(lastFromSeat(list, 0)?.slug).toBe("wow");
    expect(lastFromSeat(list, 1)?.slug).toBe("gg");
    expect(lastFromSeat(list, 0 as number, )?.at).toBe(T + 500);
  });
});

describe("pushEmote", () => {
  it("appends a reaction", () => {
    const out = pushEmote([], 0, "nice", T);
    expect(out).toEqual([rec(0, "nice", T)]);
  });

  it("prunes expired entries as it appends", () => {
    const stale = [rec(1, "wow", T - EMOTE_TTL_MS - 1)];
    expect(pushEmote(stale, 0, "nice", T)).toEqual([rec(0, "nice", T)]);
  });

  it("ignores an unknown slug rather than storing it", () => {
    const list = [rec(0, "nice", T)];
    expect(pushEmote(list, 1, "'; DROP TABLE", T + 5000)).toBe(list);
  });

  it("silently no-ops while the seat is on cooldown", () => {
    const first = pushEmote([], 0, "nice", T);
    const second = pushEmote(first, 0, "wow", T + 100);
    expect(second).toEqual(first);
  });

  it("caps the buffer so a spammer can't grow the row unbounded", () => {
    let list: EmoteRecord[] = [];
    for (let i = 0; i < MAX_EMOTES + 6; i++) {
      // Alternate seats and clear the cooldown each time.
      list = pushEmote(list, i % 2, "fire", T + i * EMOTE_COOLDOWN_MS);
    }
    expect(list.length).toBeLessThanOrEqual(MAX_EMOTES);
  });

  it("keeps the newest entries when it caps", () => {
    let list: EmoteRecord[] = [];
    for (let i = 0; i < MAX_EMOTES + 3; i++) {
      list = pushEmote(list, i % 2, "fire", T + i * EMOTE_COOLDOWN_MS);
    }
    const times = list.map((e) => e.at);
    expect(Math.max(...times)).toBe(T + (MAX_EMOTES + 2) * EMOTE_COOLDOWN_MS);
  });
});
