"use client";

/**
 * Screen 3. Water Tankers.
 *
 * Tankers split into two genuinely different products, so this page is a
 * chooser that routes into the right module rather than a single mixed form.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Building, Check, Clock, Star, Truck } from "@/components/icons";
import { Badge, Button, PageHeader, VerifiedBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { litres, money } from "@/lib/format";
import type { DriverWithOperator, TankerTier } from "@/lib/types";

const MODULES = [
  {
    href: "/tankers/home",
    image: "/images/products/tanker-rural.jpg",
    icon: Truck,
    eyebrow: "For individuals",
    title: "Home & Individual",
    blurb:
      "One tanker for your house, garden, construction top-up or a small family function.",
    points: [
      "1,000 L to 5,000 L per trip",
      "From ₹450 a trip",
      "Same-day slots where available",
      "Cancel free before dispatch",
    ],
    accent: "from-brand-500 to-brand-700",
  },
  {
    href: "/tankers/society",
    image: "/images/products/tanker-street.jpg",
    icon: Building,
    eyebrow: "For societies and bulk",
    title: "Society & Institutional",
    blurb:
      "Bulk trips for housing societies, schools, hostels and offices, on contract pricing.",
    points: [
      "5,000 L to 12,000 L per trip",
      "8% below the individual rate",
      "Cost split per flat shown up front",
      "Recurring monthly contracts",
    ],
    accent: "from-ink-700 to-ink-900",
  },
];

export default function TankersPage() {
  const [tiers, setTiers] = useState<TankerTier[]>([]);
  const [drivers, setDrivers] = useState<DriverWithOperator[]>([]);

  useEffect(() => {
    api.tankers().then(setTiers).catch(() => setTiers([]));
    api.drivers({ lat: 22.7196, lng: 75.8577 }).then(setDrivers).catch(() => setDrivers([]));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Bulk water"
        title="Water Tankers"
        subtitle="Billed per trip, not per litre. Choose the module that matches who you are booking for."
      />

      {/* Two modules */}
      <div className="grid gap-5 lg:grid-cols-2">
        {MODULES.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="card group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-(--shadow-lift)"
          >
            <div className="relative h-48">
              <Image
                src={module.image}
                alt={module.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className={`absolute inset-0 bg-linear-to-tr ${module.accent} opacity-80`} />
              <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                  {module.eyebrow}
                </span>
                <span className="mt-1 flex items-center gap-2 text-2xl font-bold">
                  <module.icon className="size-6" />
                  {module.title}
                </span>
              </div>
            </div>

            <div className="p-5">
              <p className="text-sm leading-relaxed text-ink-600">{module.blurb}</p>
              <ul className="mt-4 space-y-2">
                {module.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-ink-600">
                    <Check className="mt-0.5 size-4 shrink-0 text-success-500" strokeWidth={3} />
                    {point}
                  </li>
                ))}
              </ul>
              <span className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5">
                Open this module →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* All capacities at a glance */}
      <section className="mt-12">
        <h2 className="mb-3 text-lg font-bold text-ink-900">All tanker capacities</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Capacity</th>
                <th className="px-4 py-3 font-semibold">Segment</th>
                <th className="px-4 py-3 font-semibold">Best for</th>
                <th className="px-4 py-3 font-semibold">Typical ETA</th>
                <th className="px-4 py-3 text-right font-semibold">Per trip</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {tiers.length === 0
                ? [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <div className="skeleton h-5 w-full rounded" />
                      </td>
                    </tr>
                  ))
                : tiers.map((tier) => (
                    <tr key={tier.id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-bold text-ink-900">
                        {litres(tier.capacity_l)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={tier.segment === "society" ? "neutral" : "brand"}>
                          {tier.segment === "society" ? "Society" : "Individual"}
                        </Badge>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-ink-600">{tier.description}</td>
                      <td className="px-4 py-3 text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {Math.round(tier.eta_minutes / 60)} hr
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-700">
                        {money(tier.base_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={tier.segment === "society" ? "/tankers/society" : "/tankers/home"}>
                          <Button size="sm" variant="secondary">
                            Book
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Driver preview */}
      <section className="mt-12">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Who will deliver it</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Drivers on the platform, and the operators they work under.
            </p>
          </div>
          <Link href="/drivers">
            <Button variant="secondary" size="sm">
              View full roster
            </Button>
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {drivers.length === 0
            ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)
            : drivers.slice(0, 4).map((row) => (
                <article key={row.driver.id} className="card p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                      {row.driver.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {row.driver.name}
                      </p>
                      <p className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                        <Star filled className="size-3 text-accent-500" />
                        {row.driver.rating.toFixed(1)} · {row.driver.trips_completed} trips
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 border-t border-ink-100 pt-2.5 text-[11px]">
                    <p className="truncate text-ink-500">
                      Works for <span className="font-medium text-ink-700">{row.operator_name}</span>
                    </p>
                    <p className="font-mono text-ink-600">{row.driver.vehicle_number}</p>
                    <p className="text-ink-500">{litres(row.driver.vehicle_capacity_l)} capacity</p>
                  </div>
                  {row.operator_verified && (
                    <div className="mt-2.5">
                      <VerifiedBadge />
                    </div>
                  )}
                </article>
              ))}
        </div>
      </section>
    </div>
  );
}
