import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  isUnlocked,
  resolveTheme,
  THEMES,
  themeById,
  unlockedThemes,
} from "./themes";

describe("theme catalogue", () => {
  it("has unique ids and exactly one always-available theme", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(THEMES.filter((t) => t.unlockedBy === null).map((t) => t.id)).toEqual([
      DEFAULT_THEME,
    ]);
  });

  it("gates every other theme on a real achievement slug", () => {
    for (const t of THEMES.filter((t) => t.unlockedBy !== null)) {
      expect(typeof t.unlockedBy).toBe("string");
      expect(t.unlockedBy!.length).toBeGreaterThan(0);
    }
  });
});

describe("isUnlocked / unlockedThemes", () => {
  it("gives a brand-new player only the default", () => {
    expect(unlockedThemes([]).map((t) => t.id)).toEqual([DEFAULT_THEME]);
  });

  it("opens a theme once its trophy is held", () => {
    const gold = themeById("gold")!;
    expect(isUnlocked(gold, [])).toBe(false);
    expect(isUnlocked(gold, ["queens-crown"])).toBe(true);
  });

  it("ignores unrelated trophies", () => {
    expect(isUnlocked(themeById("gold")!, ["first-hand", "natural"])).toBe(false);
  });
});

// localStorage is client-controlled, so an unearned id must never render.
describe("resolveTheme", () => {
  it("honours a legitimately unlocked selection", () => {
    expect(resolveTheme("midnight", ["first-hand"])).toBe("midnight");
  });

  it("falls back when the player hasn't earned it", () => {
    expect(resolveTheme("gold", [])).toBe(DEFAULT_THEME);
  });

  it("falls back on an unknown or absent id", () => {
    expect(resolveTheme("not-a-theme", ["queens-crown"])).toBe(DEFAULT_THEME);
    expect(resolveTheme(null, ["queens-crown"])).toBe(DEFAULT_THEME);
  });

  it("always allows the default", () => {
    expect(resolveTheme(DEFAULT_THEME, [])).toBe(DEFAULT_THEME);
  });
});
