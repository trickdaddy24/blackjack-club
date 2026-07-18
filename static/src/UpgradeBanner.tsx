import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

// sessionStorage, not localStorage: dismissing quiets the banner for THIS
// visit only. A demo player who closes the tab and comes back later (or
// just reloads) sees the pitch again — the old localStorage flag hid it
// forever after a single reflex dismiss, which is most of why this wasn't
// converting anyone.
const DISMISS_KEY = "bj-upgrade-dismissed";
export const FULL_SITE_URL = "https://play.minus-one-labs.com";

/**
 * Nudge toward the full club. Copy rotates through what's actually live
 * there right now — Hot Seat drops, VIP tiers, the Vegas property bonus,
 * match-play vouchers — not a stale features list. Dismissible per visit;
 * the footer keeps a permanent link so the path never fully disappears.
 */
const PITCHES = [
  "Chips that follow you everywhere — this demo's bankroll lives only in this browser",
  "🔥 Hot Seat drops surprise a random active player with a chip bonus, live",
  "⭐ VIP tiers — the more you play, the bigger your daily bonus gets",
  "🎰 A free Vegas property pick every day for a surprise cash bonus",
  "🎟️ Come back after a break and your next win doubles, automatically",
];

export function UpgradeBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [pitch] = useState(() => PITCHES[Math.floor(Math.random() * PITCHES.length)]);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  return (
    <div className="mx-auto mb-3 w-full max-w-4xl px-3">
      <div className="gold-ring relative flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-black/40 px-4 py-3 sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 font-display text-sm font-bold tracking-wide gold-text">
            <Sparkles className="h-4 w-4" />
            Upgrade your table
          </span>
          <span className="text-xs text-[var(--cream)]/60">{pitch}</span>
        </div>
        <div className="flex items-center gap-2">
          <a href={FULL_SITE_URL} className="action-btn primary !py-1.5 !text-xs">
            Play the Full Club
          </a>
          <button
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--cream)]/40 transition-colors hover:text-[var(--cream)]/80"
            title="Dismiss for this visit"
            aria-label="Dismiss upgrade banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
