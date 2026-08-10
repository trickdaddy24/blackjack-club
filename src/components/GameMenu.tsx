"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { activeCategories, gamesIn, type GameCategory } from "@/lib/games";

// Why this is a client component rather than the CSS-only version it replaced:
//
// The first cut used `group-hover:` with `group-focus-within:` as the fallback,
// which works on desktop and is completely dead on iPhone:
//   1. there is no hover on a touchscreen, and iOS's "first tap emulates hover"
//      heuristic is unreliable;
//   2. iOS Safari does NOT focus <button> elements when you tap them (long
//      standing default), so :focus-within never becomes true either.
// The menu was therefore unopenable on iOS. Explicit click state is the only
// thing that behaves the same for touch, mouse and keyboard.
//
// TopBar stays a server component — it just renders these.

/** Shared dropdown panel styling. */
const PANEL =
  "gold-ring min-w-52 overflow-hidden rounded-xl bg-[#12100c] py-1 shadow-xl";
const ITEM =
  "block px-4 py-2.5 text-xs normal-case tracking-normal text-[var(--cream)]/75 transition-colors hover:bg-[var(--gold)]/15 hover:text-[var(--gold-bright)]";

/** Close on outside pointer-down and on Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // pointerdown covers mouse and touch in one listener
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

/** One category dropdown in the desktop bar. */
function CategoryMenu({ category }: { category: GameCategory }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const entries = gamesIn(category, true);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1 uppercase tracking-widest transition-colors ${
          open ? "text-[var(--gold-bright)]" : "text-[var(--cream)]/70 hover:text-[var(--gold-bright)]"
        }`}
      >
        {category}
        <span
          aria-hidden
          className={`text-[9px] leading-none opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 pt-2">
          <div className={PANEL}>
            {entries.map((g) => (
              <Link
                key={g.href}
                href={g.href}
                title={g.blurb}
                onClick={() => setOpen(false)}
                className={ITEM}
              >
                {g.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The game dropdowns — desktop only; the phone gets MobileNav instead. */
export function GameMenus() {
  return (
    <>
      {activeCategories(true).map((cat) => (
        <CategoryMenu key={cat} category={cat} />
      ))}
    </>
  );
}

export interface MobileLink {
  href: string;
  label: string;
}

/**
 * Phone nav: the whole bar collapses behind one hamburger, because four
 * category dropdowns plus the utility links cannot fit ~390px however they're
 * triggered. `extra` carries the non-game links (Gym/Leaders/Rules/…) so they
 * don't vanish on mobile.
 */
export function MobileNav({ extra }: { extra: MobileLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  // Don't leave the panel hanging open behind a route change.
  const close = () => setOpen(false);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-[var(--cream)]/70 transition-colors hover:text-[var(--gold-bright)] gold-ring"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div className={`${PANEL} max-h-[70vh] w-56 overflow-y-auto`}>
            {activeCategories(true).map((cat) => (
              <div key={cat} className="border-b border-[var(--gold)]/10 last:border-b-0">
                <p className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--cream)]/40">
                  {cat}
                </p>
                {gamesIn(cat, true).map((g) => (
                  <Link key={g.href} href={g.href} onClick={close} className={ITEM}>
                    {g.label}
                  </Link>
                ))}
              </div>
            ))}
            {extra.length > 0 && (
              <div className="border-t border-[var(--gold)]/10 pt-1">
                {extra.map((l) => (
                  <Link key={l.href} href={l.href} onClick={close} className={ITEM}>
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
