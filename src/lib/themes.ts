// Table themes — unlockable felt + matching card back, earned with trophies.
//
// Built on the mechanism the Trilux table proved: every component already
// styles off the `--felt*` / `--gold*` custom properties, so overriding them
// on one wrapper attribute reskins the whole table with no component changes.
// Trilux uses `[data-room="trilux"]`; themes use `[data-theme="…"]`.
//
// Scope: the CLASSIC table only. Trilux keeps its burgundy identity so the two
// tables stay distinguishable at a glance — which is the whole reason it was
// skinned in the first place.
//
// Which themes you OWN lives in the DB (Achievement rows). Which one you've
// SELECTED is localStorage, matching every other table preference here.

export interface Theme {
  id: string;
  name: string;
  /** One line shown in the picker. */
  blurb: string;
  /** Achievement slug that unlocks it; null = always available. */
  unlockedBy: string | null;
  /** Swatch for the picker — the felt's mid tone. */
  swatch: string;
}

export const DEFAULT_THEME = "classic";

export const THEMES: Theme[] = [
  {
    id: "classic",
    name: "Casino Green",
    blurb: "The house table. Always available.",
    unlockedBy: null,
    swatch: "#145741",
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    blurb: "Late-night felt. Play your first hand.",
    unlockedBy: "first-hand",
    swatch: "#123258",
  },
  {
    id: "crimson",
    name: "Crimson Heat",
    blurb: "Earned on a ten-round tear.",
    unlockedBy: "hot-streak-10",
    swatch: "#6d1420",
  },
  {
    id: "royal",
    name: "Royal Purple",
    blurb: "For the regulars — 100 rounds played.",
    unlockedBy: "grinder-100",
    swatch: "#3b1a5c",
  },
  {
    id: "slate",
    name: "Slate & Steel",
    blurb: "Cool and quiet. Hold 90%+ blind accuracy.",
    unlockedBy: "by-the-book",
    swatch: "#2b3440",
  },
  {
    id: "highroller",
    name: "High Roller",
    blurb: "Deep teal and brass. Reach 100,000 chips.",
    unlockedBy: "high-roller-100k",
    swatch: "#0d4a4a",
  },
  {
    id: "gold",
    name: "Gold Vault",
    blurb: "Gold card backs. Win the progressive jackpot.",
    unlockedBy: "queens-crown",
    swatch: "#5c4410",
  },
];

export function themeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}

/** Is this theme available to a player holding `earned` achievement slugs? */
export function isUnlocked(theme: Theme, earned: string[]): boolean {
  return theme.unlockedBy === null || earned.includes(theme.unlockedBy);
}

/** Themes this player can actually pick, in catalogue order. */
export function unlockedThemes(earned: string[]): Theme[] {
  return THEMES.filter((t) => isUnlocked(t, earned));
}

/**
 * Resolve a stored selection to a theme the player is genuinely entitled to.
 * Falls back to the default when the id is unknown or no longer unlocked —
 * localStorage is client-controlled, so an unearned id must never render.
 */
export function resolveTheme(selected: string | null, earned: string[]): string {
  const t = selected ? themeById(selected) : undefined;
  return t && isUnlocked(t, earned) ? t.id : DEFAULT_THEME;
}
