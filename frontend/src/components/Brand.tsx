"use client";

/** Brand flourishes: the animated tricolour, the big wordmark, and the FAQ list. */

import { useEffect, useRef, useState } from "react";

import { cx } from "@/lib/format";
import { WaterDrop } from "./icons";

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

/* -------------------------------------------------------------------------- */
/* Oversized animated wordmark                                                 */
/* -------------------------------------------------------------------------- */

export function BigWordmark() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShown(true);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const letters = "JAL 24×7".split("");

  return (
    <div ref={ref} className="relative overflow-hidden py-16 sm:py-20">
      {/* Water-like sheen sweeping across the letters */}
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-center">
          <span
            className={cx(
              "grid size-16 place-items-center rounded-3xl bg-brand-600 text-white shadow-lg transition-all duration-700",
              shown ? "translate-y-0 rotate-0 opacity-100" : "translate-y-6 -rotate-12 opacity-0",
            )}
          >
            <WaterDrop filled className="size-8" />
          </span>
        </div>

        <h2
          aria-label="JAL 24x7"
          className="jal-big select-none text-[clamp(3rem,15vw,11rem)] font-black leading-[0.85] tracking-tighter"
        >
          {letters.map((char, index) => (
            <span
              key={`${char}-${index}`}
              aria-hidden
              className={cx(
                "inline-block transition-all duration-700 ease-out",
                shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-10 opacity-0 blur-sm",
              )}
              style={{ transitionDelay: `${index * 70}ms` }}
            >
              {char === " " ? " " : char}
            </span>
          ))}
        </h2>

        <p
          className={cx(
            "mt-6 text-sm font-medium tracking-[0.35em] text-ink-400 transition-all duration-700 sm:text-base",
            shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: "620ms" }}
        >
          CLEAN WATER, ANYTIME
        </p>

        <div
          className={cx(
            "mt-8 flex justify-center transition-all duration-700",
            shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
          style={{ transitionDelay: "760ms" }}
        >
          <MadeInIndia />
        </div>
      </div>

      <style>{`
        .jal-big {
          background: linear-gradient(
            100deg,
            #1c4a8c 0%, #1f80f0 22%, #5dbeff 38%, #ffffff 48%,
            #5dbeff 58%, #1f80f0 76%, #1c4a8c 100%
          );
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: jalsheen 7s linear infinite;
        }
        @keyframes jalsheen {
          from { background-position: 200% 0; }
          to   { background-position: -50% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .jal-big { animation: none; background-position: 50% 0; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ accordion                                                               */
/* -------------------------------------------------------------------------- */

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-50/60"
              >
                <span
                  className={cx(
                    "text-sm font-semibold sm:text-base",
                    isOpen ? "text-brand-700" : "text-ink-900",
                  )}
                >
                  {item.question}
                </span>
                <span
                  className={cx(
                    "grid size-7 shrink-0 place-items-center rounded-full transition-all duration-300",
                    isOpen ? "rotate-180 bg-brand-600 text-white" : "bg-ink-100 text-ink-500",
                  )}
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div
              className={cx(
                "grid transition-all duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-sm leading-relaxed text-ink-600">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* In-page section navigation                                                  */
/* -------------------------------------------------------------------------- */

export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] },
    );

    for (const section of sections) {
      const node = document.getElementById(section.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-16 z-30 border-y border-ink-100 bg-white/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cx(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active === section.id
                ? "bg-brand-600 text-white"
                : "text-ink-500 hover:bg-ink-50 hover:text-ink-900",
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
