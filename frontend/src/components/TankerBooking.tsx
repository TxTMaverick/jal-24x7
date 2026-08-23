"use client";

/**
 * Shared tanker booking module.
 *
 * Rendered by both /tankers/home and /tankers/society. The two segments are
 * genuinely different products, so they get separate routes and separate copy,
 * but the booking mechanics (capacity, schedule, driver preference) are shared.
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Building,
  Calendar,
  Check,
  Clock,
  MapPin,
  Phone,
  Star,
  Truck,
} from "@/components/icons";
import {
  Badge,
  Button,
  ErrorState,
  Field,
  PageHeader,
  QuantityStepper,
  VerifiedBadge,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, eta, litres, money } from "@/lib/format";
import { saveSchedule, scheduleLabel } from "@/lib/schedule";
import type { DriverWithOperator, TankerTier } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";

const INDORE: [number, number] = [22.7196, 75.8577];

const TIME_WINDOWS = [
  "06:00 to 08:00",
  "08:00 to 10:00",
  "10:00 to 12:00",
  "12:00 to 15:00",
  "15:00 to 18:00",
  "18:00 to 21:00",
];

function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface TankerModuleCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  checklist: string[];
  pricingNote: string;
}

export function TankerBooking({
  segment,
  copy,
}: {
  segment: "individual" | "society";
  copy: TankerModuleCopy;
}) {
  const { addTanker } = useCart();
  const { success, error: toastError } = useToast();

  const [tiers, setTiers] = useState<TankerTier[]>([]);
  const [drivers, setDrivers] = useState<DriverWithOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [trips, setTrips] = useState(1);
  const [date, setDate] = useState(() => isoDate(1));
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[1]);

  // Society-only inputs
  const [societyName, setSocietyName] = useState("");
  const [units, setUnits] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tierList, driverList] = await Promise.all([
        api.tankers(segment),
        api.drivers({ lat: INDORE[0], lng: INDORE[1] }),
      ]);
      setTiers(tierList);
      setSelectedId(tierList[0]?.id ?? null);
      setDrivers(driverList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tanker options.");
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => tiers.find((t) => t.id === selectedId) ?? null,
    [tiers, selectedId],
  );

  // Only drivers whose vehicle can actually carry the chosen load.
  const eligibleDrivers = useMemo(
    () =>
      selected
        ? drivers
            .filter((d) => d.driver.vehicle_capacity_l >= selected.capacity_l)
            .slice(0, 4)
        : [],
    [drivers, selected],
  );

  const estimate = selected
    ? selected.base_price * trips * (segment === "society" ? 0.92 : 1)
    : 0;

  const perFlat =
    segment === "society" && units > 0 ? estimate / units : null;

  const handleBook = () => {
    if (!selected) return;
    if (segment === "society" && societyName.trim().length < 2) {
      toastError("Enter the name of the society or institution.");
      return;
    }
    const schedule = { date, window: timeWindow };
    saveSchedule(schedule);
    addTanker(selected, trips);
    success(
      `${trips} × ${litres(selected.capacity_l)} tanker scheduled for ${scheduleLabel(schedule)}.`,
      "Added to cart",
    );
  };

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link href="/tankers" className="text-sm font-medium text-brand-600 hover:text-brand-700">
          ← Back to tanker options
        </Link>
      </div>

      <PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle} />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          {/* ---- Capacity ---- */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
              1. Choose a tanker capacity
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {loading
                ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-56 rounded-2xl" />)
                : tiers.map((tier) => {
                    const active = tier.id === selectedId;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedId(tier.id)}
                        aria-pressed={active}
                        className={cx(
                          "card overflow-hidden text-left transition-all",
                          active
                            ? "ring-2 ring-brand-500 ring-offset-1"
                            : "hover:-translate-y-0.5 hover:shadow-(--shadow-lift)",
                        )}
                      >
                        <span className="relative block h-24 bg-brand-50">
                          <Image
                            src={tier.image_url || "/images/products/tanker-yellow.jpg"}
                            alt={`${tier.capacity_l} litre water tanker`}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover"
                          />
                          {active && (
                            <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand-600 text-white">
                              <Check className="size-3.5" strokeWidth={3} />
                            </span>
                          )}
                        </span>
                        <span className="block p-3.5">
                          <span className="block text-lg font-bold leading-tight text-ink-900">
                            {litres(tier.capacity_l)}
                          </span>
                          <span className="block text-[11px] text-ink-400">
                            {tier.capacity_l.toLocaleString("en-IN")} litres per trip
                          </span>
                          <span className="mt-2 line-clamp-2 block text-xs leading-relaxed text-ink-500">
                            {tier.description}
                          </span>
                          <span className="mt-2.5 flex items-end justify-between border-t border-ink-100 pt-2.5">
                            <span className="text-base font-bold text-brand-700">
                              {money(tier.base_price)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                              <Clock className="size-3" />
                              {eta(tier.eta_minutes)}
                            </span>
                          </span>
                        </span>
                      </button>
                    );
                  })}
            </div>
          </section>

          {/* ---- Society details ---- */}
          {segment === "society" && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                2. Society details
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Society or institution name" required>
                  <input
                    value={societyName}
                    onChange={(e) => setSocietyName(e.target.value)}
                    placeholder="For example, Silver Springs RWA"
                    className={inputClass}
                  />
                </Field>
                <Field label="Number of flats or units" hint="Used to split the cost per flat">
                  <input
                    type="number"
                    min={1}
                    max={5000}
                    value={units}
                    onChange={(e) => setUnits(Number(e.target.value) || 1)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* ---- Schedule ---- */}
          <section className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {segment === "society" ? "3" : "2"}. Pick a delivery slot
            </h2>
            <p className="mt-1 text-xs text-ink-500">
              Tankers are scheduled rather than instant, because a trip has to fit the operator
              route.
            </p>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Delivery date" required>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
                  <input
                    type="date"
                    value={date}
                    min={isoDate(0)}
                    onChange={(e) => setDate(e.target.value)}
                    className={cx(inputClass, "pl-9")}
                  />
                </div>
              </Field>
              <Field label="Preferred window" required>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className={inputClass}
                >
                  {TIME_WINDOWS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 p-3">
              <span className="text-sm text-ink-600">
                Number of trips
                {selected && (
                  <span className="block text-xs text-ink-400">
                    {litres(selected.capacity_l)} each, {litres(selected.capacity_l * trips)} total
                  </span>
                )}
              </span>
              <QuantityStepper value={trips} onChange={setTrips} max={segment === "society" ? 30 : 10} />
            </div>
          </section>

          {/* ---- Drivers ---- */}
          {eligibleDrivers.length > 0 && (
            <section className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                    Drivers who can take this trip
                  </h2>
                  <p className="mt-1 text-xs text-ink-500">
                    One of these is assigned automatically based on distance and availability.
                  </p>
                </div>
                <Link href="/drivers" className="text-sm font-semibold text-brand-600">
                  See all →
                </Link>
              </div>

              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {eligibleDrivers.map((row) => (
                  <li
                    key={row.driver.id}
                    className="flex items-center gap-3 rounded-xl bg-ink-50 p-3"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                      {row.driver.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {row.driver.name}
                      </p>
                      <p className="truncate text-[11px] text-ink-500">
                        {row.operator_name} · {row.driver.vehicle_number}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-500">
                        <Star filled className="size-3 text-accent-500" />
                        {row.driver.rating.toFixed(1)} · {row.driver.trips_completed} trips
                      </p>
                    </div>
                    <a href={`tel:+91${row.driver.phone}`} aria-label={`Call ${row.driver.name}`}>
                      <span className="grid size-8 place-items-center rounded-lg bg-white text-brand-600 ring-1 ring-ink-200 transition-colors hover:bg-brand-50">
                        <Phone className="size-4" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ---------------- Summary ---------------- */}
        <aside className="card sticky top-20 p-5">
          <h2 className="font-semibold text-ink-900">Booking summary</h2>

          {selected ? (
            <>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Capacity" value={`${litres(selected.capacity_l)} × ${trips}`} />
                <Row label="Total volume" value={litres(selected.capacity_l * trips)} />
                <Row label="Rate per trip" value={money(selected.base_price)} />
                {segment === "society" && (
                  <div className="flex justify-between text-success-600">
                    <span>Society contract rate</span>
                    <span className="font-semibold">8% off applied</span>
                  </div>
                )}
                <Row label="Slot" value={`${date}, ${timeWindow}`} />
              </div>

              <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-3">
                <span className="text-sm font-medium text-ink-700">Estimated</span>
                <span className="text-2xl font-bold text-ink-900">{money(estimate)}</span>
              </div>

              {perFlat !== null && (
                <p className="mt-1.5 rounded-lg bg-success-50 p-2.5 text-xs text-success-600">
                  Roughly <strong>{money(perFlat)}</strong> per flat across {units} units.
                </p>
              )}

              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                {copy.pricingNote}
              </p>
            </>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          )}

          <Button fullWidth size="lg" className="mt-5" onClick={handleBook} disabled={!selected}>
            Add trip to cart
          </Button>
          <Link href="/cart" className="mt-2 block">
            <Button fullWidth variant="ghost" size="sm">
              Go to cart →
            </Button>
          </Link>

          <ul className="mt-5 space-y-2 border-t border-ink-100 pt-4">
            {copy.checklist.map((line) => (
              <li key={line} className="flex items-start gap-2 text-xs text-ink-600">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success-500" strokeWidth={3} />
                {line}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent-400/10 p-3">
            <Badge tone="warn">Note</Badge>
            <p className="text-[11px] leading-relaxed text-ink-600">
              Tanker trips cannot share a cart with bottles or cans. They are a different order
              type with their own per-trip billing.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-ink-600">
      <span className="shrink-0">{label}</span>
      <span className="truncate text-right font-semibold text-ink-900">{value}</span>
    </div>
  );
}
