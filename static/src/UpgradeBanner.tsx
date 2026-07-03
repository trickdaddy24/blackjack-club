import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "bj-upgrade-dismissed";
export const FULL_SITE_URL = "https://play.minus-one-labs.com";

/**
 * Nudge toward the full club: accounts, chips that follow you, Spanish 21,
 * bot players, and the card counter. Dismissible; the footer keeps a
 * permanent low-key link so the path never disappears.
 */
export function UpgradeBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
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
          <span className="text-xs text-[var(--cream)]/60">
            Spanish 21 · bot players · Hi-Lo card counter · chips saved to your
            account, on every device
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href={FULL_SITE_URL} className="action-btn primary !py-1.5 !text-xs">
            Play the Full Club
          </a>
          <button
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--cream)]/40 transition-colors hover:text-[var(--cream)]/80"
            title="Dismiss"
            aria-label="Dismiss upgrade banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
