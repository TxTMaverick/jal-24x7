"use client";

/**
 * Brand intro overlay.
 *
 * Two uses:
 *  1. Once when the site is first opened in a browser session: the logo draws
 *     itself, the wordmark resolves, and the page underneath is revealed.
 *     Gated by sessionStorage so it does not replay on every navigation.
 *  2. On demand, when the header wordmark is clicked. The brief asks for the
 *     logo to replay the animation rather than navigate anywhere.
 */

import { useEffect, useState } from "react";

import { cx } from "@/lib/format";

const SESSION_KEY = "jal24x7_splash_seen";

/** How long the intro holds before it fades out, in ms. */
const HOLD_MS = 1900;
const FADE_MS = 480;

export function SplashOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setLeaving(false);
      return;
    }
    const fadeTimer = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const doneTimer = window.setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      role="presentation"
      className={cx(
        "fixed inset-0 z-[2000] grid place-items-center overflow-hidden",
        "bg-linear-to-b from-white via-brand-50 to-brand-100",
        "transition-opacity ease-out",
        leaving ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Ripple rings spreading from where the drop lands. */}
      <span
        aria-hidden
        className="absolute size-40 rounded-full bg-brand-400/20 animate-(--animate-ripple)"
      />
      <span
        aria-hidden
        className="absolute size-40 rounded-full bg-brand-400/15 animate-(--animate-ripple)"
        style={{ animationDelay: "0.5s" }}
      />
      <span
        aria-hidden
        className="absolute size-40 rounded-full bg-brand-400/10 animate-(--animate-ripple)"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative flex flex-col items-center px-6">
        <AnimatedLogo />

        <div className="mt-6 text-center">
          <h1 className="jal-intro-word text-4xl font-black tracking-tight text-ink-900 sm:text-5xl">
            JAL <span className="text-brand-600">24×7</span>
          </h1>
          <p
            className="mt-2.5 text-xs font-semibold uppercase tracking-[0.42em] text-ink-400 animate-(--animate-fade-up) sm:text-sm"
            style={{ animationDelay: "0.75s" }}
          >
            Clean water, delivered
          </p>
        </div>
      </div>

      <style>{`
        /* The wordmark resolves out of a blur rather than just fading in. */
        .jal-intro-word {
          animation: jal-word 0.9s cubic-bezier(.2,.8,.2,1) 0.45s both;
        }
        @keyframes jal-word {
          from { opacity: 0; transform: translateY(10px) scale(.96); filter: blur(6px); letter-spacing: .12em; }
          to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); letter-spacing: -.02em; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jal-intro-word { animation: none; }
        }
      `}</style>
    </div>
  );
}

/**
 * The mark: a drop whose outline draws itself, then fills with water.
 *
 * Drawn as a stroked path with an animated dash offset, so the logo appears
 * to be written rather than simply appearing.
 */
function AnimatedLogo() {
  return (
    <span className="relative grid size-28 place-items-center sm:size-32">
      <svg viewBox="0 0 100 100" className="jal-mark size-full" aria-hidden>
        <defs>
          <linearGradient id="jal-drop-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5dbeff" />
            <stop offset="100%" stopColor="#1968dc" />
          </linearGradient>
          {/* Clips the rising water to the inside of the drop. */}
          <clipPath id="jal-drop-clip">
            <path d="M50 12 C50 12 78 44 78 62 A28 28 0 0 1 22 62 C22 44 50 12 50 12 Z" />
          </clipPath>
        </defs>

        {/* Water rising inside the mark. */}
        <g clipPath="url(#jal-drop-clip)">
          <rect className="jal-mark-water" x="0" y="0" width="100" height="100" fill="url(#jal-drop-fill)" />
        </g>

        {/* Outline, drawn on. */}
        <path
          className="jal-mark-outline"
          d="M50 12 C50 12 78 44 78 62 A28 28 0 0 1 22 62 C22 44 50 12 50 12 Z"
          fill="none"
          stroke="#1f80f0"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Highlight glint. */}
        <path
          className="jal-mark-glint"
          d="M38 58 A12 12 0 0 1 44 47"
          fill="none"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>

      <style>{`
        .jal-mark { filter: drop-shadow(0 10px 22px rgba(31,128,240,.28)); }

        .jal-mark-outline {
          stroke-dasharray: 210;
          stroke-dashoffset: 210;
          animation: jal-draw 1s ease-out forwards;
        }
        @keyframes jal-draw { to { stroke-dashoffset: 0; } }

        /* Water climbs once the outline is most of the way drawn. */
        .jal-mark-water {
          transform: translateY(100%);
          animation: jal-rise .85s cubic-bezier(.4,0,.2,1) .6s forwards;
        }
        @keyframes jal-rise { to { transform: translateY(0); } }

        .jal-mark-glint { opacity: 0; animation: jal-glint .5s ease-out 1.25s forwards; }
        @keyframes jal-glint { to { opacity: .9; } }

        @media (prefers-reduced-motion: reduce) {
          .jal-mark-outline { stroke-dashoffset: 0; animation: none; }
          .jal-mark-water { transform: translateY(0); animation: none; }
          .jal-mark-glint { opacity: .9; animation: none; }
        }
      `}</style>
    </span>
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
      // Private mode / storage disabled. just skip the intro.
    }
  }, []);

  return [showing, () => setShowing(false)];
}
