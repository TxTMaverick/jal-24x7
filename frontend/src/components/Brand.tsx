"use client";

/** Brand flourishes: the animated tricolour and the badge that wraps it. */

import { cx } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Animated Indian flag                                                        */
/* -------------------------------------------------------------------------- */

export function IndiaFlag({ className }: { className?: string }) {
  return (
    <span
      className={cx("relative inline-block overflow-hidden rounded-[3px] shadow-sm", className)}
      role="img"
      aria-label="Flag of India"
    >
      <span className="jal-flag block size-full">
        <span className="block h-1/3 w-full bg-[#FF9933]" />
        <span className="relative block h-1/3 w-full bg-white">
          {/* Ashoka Chakra */}
          <svg
            viewBox="0 0 100 100"
            className="absolute left-1/2 top-1/2 h-[95%] -translate-x-1/2 -translate-y-1/2"
            aria-hidden
          >
            <circle cx="50" cy="50" r="44" fill="none" stroke="#000080" strokeWidth="7" />
            <circle cx="50" cy="50" r="8" fill="#000080" />
            <g stroke="#000080" strokeWidth="3.4">
              {Array.from({ length: 24 }, (_, i) => {
                const angle = (i * 15 * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={50 + 9 * Math.cos(angle)}
                    y1={50 + 9 * Math.sin(angle)}
                    x2={50 + 42 * Math.cos(angle)}
                    y2={50 + 42 * Math.sin(angle)}
                  />
                );
              })}
            </g>
          </svg>
        </span>
        <span className="block h-1/3 w-full bg-[#138808]" />
      </span>

      <style>{`
        .jal-flag {
          animation: jalwave 3.2s ease-in-out infinite;
          transform-origin: left center;
        }
        @keyframes jalwave {
          0%, 100% { transform: perspective(160px) rotateY(0deg) skewY(0deg); }
          25%      { transform: perspective(160px) rotateY(-7deg) skewY(1.2deg); }
          50%      { transform: perspective(160px) rotateY(0deg) skewY(0deg); }
          75%      { transform: perspective(160px) rotateY(7deg) skewY(-1.2deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .jal-flag { animation: none; }
        }
      `}</style>
    </span>
  );
}

export function MadeInIndia({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-200",
        className,
      )}
    >
      <IndiaFlag className="h-3.5 w-5" />
      Made in India
    </span>
  );
}
