"use client";

/**
 * Water Tankers module.
 *
 * Two sections that answer the two questions people actually arrive with:
 * "is anything available right now?" and "can I book it?". Availability is
 * read from the live driver roster; booking is the same shared module the
 * dedicated /tankers/home and /tankers/society routes use, embedded here so
 * a visitor never has to leave the page to place a trip.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Building, Check, Star, Truck } from "@/components/icons";
import { TankerBooking, type TankerModuleCopy } from "@/components/TankerBooking";
import { Badge, Button, ErrorState, PageHeader, VerifiedBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { cx, litres, money } from "@/lib/format";
import type { DriverWithOperator, TankerTier } from "@/lib/types";

/** Rajwada, Indore. The service centre the roster is measured from. */
const INDORE: [number, number] = [22.7196, 75.8577];

type Segment = "individual" | "society";

const COPY: Record<Segment, TankerModuleCopy> = {
  individual: {
    eyebrow: "For individuals",
    title: "Home & Individual Tanker",
    subtitle:
      "One tanker for your house, garden, construction top-up or a small family function.",
    checklist: [
      "1,000 L to 5,000 L per trip",
      "Same-day slots where available",
      "Cancel free before dispatch",
      "Driver and vehicle number shared before arrival",
    ],
    pricingNote:
      "The trip rate covers delivery within 8 km. Beyond that a distance surcharge of ₹10 per km is added as its own line. Drinking water is nil-rated for GST.",
  },
  society: {
    eyebrow: "For societies and bulk",
    title: "Society & Institutional Tanker",
    subtitle:
      "Bulk trips for housing societies, schools, hostels and offices, on contract pricing.",
    checklist: [
      "5,000 L to 12,000 L per trip",
      "8% below the individual spot rate",
      "Cost split per flat shown up front",
      "Recurring monthly contracts available",
    ],
    pricingNote:
      "Society contract pricing is 8% below the individual rate. Recurring schedules are set up from the Subscriptions module.",
  },
};

export default function TankersPage() {
  const [segment, setSegment] = useState<Segment>("individual");

  const [tiers, setTiers] = useState<TankerTier[]>([]);
  const [drivers, setDrivers] = useState<DriverWithOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tierList, driverList] = await Promise.all([
        api.tankers(),
        api.drivers({ lat: INDORE[0], lng: INDORE[1] }),
      ]);
      setTiers(tierList);
      setDrivers(driverList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tanker availability.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Availability per capacity band.
   *
   * A vehicle can carry anything up to its own capacity, so a band counts
   * every rostered vehicle big enough for it. That is the same rule the
   * booking form uses to pick eligible drivers, so the two agree.
   */
  const bands = useMemo(() => {
    const definitions = [
      { label: "Up to 2,000 L", min: 2000, note: "Small household top-up" },
      { label: "2,000 – 5,000 L", min: 5000, note: "Full household or function" },
      { label: "5,000 – 8,000 L", min: 8000, note: "Small society or site" },
      { label: "8,000 – 12,000 L", min: 12000, note: "Large RWA or construction" },
    ];
    return definitions.map((band) => {
      const fleet = drivers.filter((d) => d.driver.vehicle_capacity_l >= band.min);
      const nearest = fleet.reduce<number | null>((best, d) => {
        const distance = d.distance_km;
        if (distance === null || distance === undefined) return best;
        return best === null || distance < best ? distance : best;
      }, null);
      return { ...band, count: fleet.length, nearest };
    });
  }, [drivers]);

  const onlineOperators = useMemo(
    () => new Set(drivers.map((d) => d.operator_name)).size,
    [drivers],
  );

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-9">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Bulk water"
        title="Water Tankers"
        subtitle="Billed per trip, not per litre. Check what is on the road right now, then book a slot."
      />

      {/* ================= AVAILABILITY ================= */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Availability right now</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              Live from the driver roster across Indore.
            </p>
          </div>
          {!loading && (
            <Badge tone="success">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              {drivers.length} vehicles · {onlineOperators} operators online
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)
            : bands.map((band) => (
                <article
                  key={band.label}
                  className={cx(
                    "card p-4",
                    band.count === 0 && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                      <Truck className="size-5" />
                    </span>
                    <Badge tone={band.count === 0 ? "neutral" : "success"}>
                      {band.count === 0 ? "None free" : `${band.count} free`}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-ink-900">{band.label}</h3>
                  <p className="mt-0.5 text-xs text-ink-500">{band.note}</p>

                  <p className="mt-2.5 border-t border-ink-100 pt-2.5 text-[11px] text-ink-500">
                    {band.nearest !== null ? (
                      <>
                        Nearest depot{" "}
                        <span className="font-semibold text-ink-700">{band.nearest} km</span> away
                      </>
                    ) : (
                      "Call the helpline for this size"
                    )}
                  </p>
                </article>
              ))}
        </div>
      </section>

      {/* ================= BOOKING ================= */}
      <section className="mb-8 scroll-mt-20" id="book">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-ink-900">Book a tanker</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Pick who this is for. The rate, the capacities offered and the paperwork differ
            between the two.
          </p>
        </div>

        {/* Segment switch */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {(
            [
              {
                key: "individual" as const,
                icon: Truck,
                title: "Home & Individual",
                detail: "1,000 L – 5,000 L · from ₹300 a trip",
              },
              {
                key: "society" as const,
                icon: Building,
                title: "Society & Institutional",
                detail: "5,000 L – 12,000 L · 8% below spot rate",
              },
            ]
          ).map((option) => {
            const active = segment === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSegment(option.key)}
                aria-pressed={active}
                className={cx(
                  "card flex items-center gap-3 p-4 text-left transition-all",
                  active
                    ? "ring-2 ring-brand-500 ring-offset-1"
                    : "hover:-translate-y-0.5 hover:shadow-(--shadow-lift)",
                )}
              >
                <span
                  className={cx(
                    "grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
                    active ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-500",
                  )}
                >
                  <option.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      "block text-sm font-semibold",
                      active ? "text-brand-700" : "text-ink-900",
                    )}
                  >
                    {option.title}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{option.detail}</span>
                </span>
                {active && (
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* The shared booking module, rendered inline. */}
        <TankerBooking embedded segment={segment} copy={COPY[segment]} />
      </section>

      {/* ================= RATE CARD ================= */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-ink-900">All capacities and rates</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Capacity</th>
                <th className="px-4 py-3 font-semibold">Segment</th>
                <th className="px-4 py-3 font-semibold">Best for</th>
                <th className="px-4 py-3 text-right font-semibold">Per trip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading
                ? [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-4 py-3">
                        <div className="skeleton h-5 w-full rounded" />
                      </td>
                    </tr>
                  ))
                : tiers.map((tier) => (
                    <tr key={tier.id} className="transition-colors hover:bg-brand-50/40">
                      <td className="px-4 py-3 font-bold text-ink-900">{litres(tier.capacity_l)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={tier.segment === "society" ? "neutral" : "brand"}>
                          {tier.segment === "society" ? "Society" : "Individual"}
                        </Badge>
                      </td>
                      <td className="max-w-sm px-4 py-3 text-ink-600">{tier.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-brand-700">
                        {money(tier.base_price)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= WHO DELIVERS ================= */}
      <section>
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
          {loading
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
