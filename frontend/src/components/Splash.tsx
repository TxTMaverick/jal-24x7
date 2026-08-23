"use client";

/**
 * Water-drop splash overlay.
 *
 * Two uses:
 *  1. Once on first visit (Screen 1's "splash then land on Home").
 *     Gated by sessionStorage so it does not replay on every navigation.
 *  2. On demand, when the header wordmark is clicked. the build brief asks
 *     for the logo to trigger a ripple and return to the current page rather
 *     than navigate anywhere.
 */

import { useEffect, useState } from "react";

import { cx } from "@/lib/format";
import { WaterDrop } from "./icons";

const SESSION_KEY = "jal24x7_splash_seen";

export function SplashOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLeaving(false);
      return;
    }
    const fadeTimer = window.setTimeout(() => setLeaving(true), 1150);
    const doneTimer = window.setTimeout(onDone, 1550);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={cx(
        "fixed inset-0 z-[2000] grid place-items-center bg-linear-to-b from-brand-50 via-white to-brand-100",
        "transition-opacity duration-400",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div className="relative grid place-items-center">
        {/* Expanding ripple rings */}
        <span className="absolute size-24 rounded-full bg-brand-400/25 animate-(--animate-ripple)" />
        <span
          className="absolute size-24 rounded-full bg-brand-400/20 animate-(--animate-ripple)"
          style={{ animationDelay: "0.45s" }}
        />
        <span
          className="absolute size-24 rounded-full bg-brand-400/15 animate-(--animate-ripple)"
          style={{ animationDelay: "0.9s" }}
        />

        <div className="relative flex flex-col items-center gap-4">
          <WaterDrop
            filled
            className="size-20 text-brand-600 drop-shadow-lg animate-(--animate-drop)"
          />
          <div
            className="text-center animate-(--animate-fade-up)"
            style={{ animationDelay: "0.35s" }}
          >
            <p className="text-2xl font-bold tracking-tight text-ink-900">
              JAL <span className="text-brand-600">24×7</span>
            </p>
            <p className="mt-1 text-sm text-ink-500">Clean water, delivered.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Returns true the first time in a browser session, false afterwards. */
export function useFirstVisitSplash(): [boolean, () => void] {
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem(SESSION_KEY)) {
        window.sessionStorage.setItem(SESSION_KEY, "1");
        setShowing(true);
      }
    } catch {
      // Private mode / storage disabled. just skip the splash.
    }
  }, []);

  return [showing, () => setShowing(false)];
}
