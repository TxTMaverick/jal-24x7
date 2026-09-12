"use client";

/**
 * Placeholder for a module that is designed but not built.
 *
 * Shown instead of a half-working screen: it states plainly what the module
 * will do and which problem it exists to solve, so the plan is legible even
 * though the feature is not there yet.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { Check } from "./icons";
import { Badge, Button } from "./ui";

export function ComingSoon({
  eyebrow,
  title,
  icon,
  problem,
  willDo,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  /** The situation today, and why it needs solving. */
  problem: string;
  /** What the module will do once built. */
  willDo: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-9 sm:px-6 lg:px-8">
      <div className="card overflow-hidden">
        <div className="flex flex-col items-center gap-4 border-b border-ink-100 bg-brand-50/60 px-6 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm">
            {icon}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              {title}
            </h1>
          </div>
          <Badge tone="warn">Coming soon</Badge>
        </div>

        <div className="px-6 py-7 sm:px-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              The problem
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{problem}</p>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              What this module will do
            </h2>
            <ul className="mt-3 space-y-2.5">
              {willDo.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <Check className="mt-0.5 size-4 shrink-0 text-success-500" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-ink-100 pt-6">
            <Link href="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
            <Link href="/contact">
              <Button variant="ghost">Contact us</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
