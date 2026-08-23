"use client";

/**
 * Tanker driver roster.
 *
 * A tanker booking sends a vehicle and a person to your gate, so who turns up
 * matters. Every driver is listed with the operator they work under.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Check, Clock, MapPin, Phone, Shield, Star, Truck } from "@/components/icons";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  VerifiedBadge,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, litres } from "@/lib/format";
import type { DriverWithOperator } from "@/lib/types";
import { useToast } from "@/store/toast";

const INDORE: [number, number] = [22.7196, 75.8577];

const CAPACITY_FILTERS = [
  { value: 0, label: "Any capacity" },
  { value: 2000, label: "2,000 L and above" },
  { value: 5000, label: "5,000 L and above" },
  { value: 8000, label: "8,000 L and above" },
  { value: 12000, label: "12,000 L only" },
];

export default function DriversPage() {
  const { toast, error: toastError } = useToast();

  const [pin, setPin] = useState<[number, number]>(INDORE);
  const [capacity, setCapacity] = useState(0);
  const [search, setSearch] = useState("");
  const [locating, setLocating] = useState(false);

  const [rows, setRows] = useState<DriverWithOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        await api.drivers({
          lat: pin[0],
          lng: pin[1],
          capacity_l: capacity || undefined,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the driver roster.");
    } finally {
      setLoading(false);
    }
  }, [pin, capacity]);

  useEffect(() => {
    void load();
  }, [load]);

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toastError("Your browser does not support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPin([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
        toast("Showing the drivers closest to you.", "success", "Location updated");
      },
      () => {
        setLocating(false);
        toastError("Could not read your location. Showing drivers around Indore city centre.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const filtered = rows.filter((row) => {
    if (!search.trim()) return true;
    const haystack =
      `${row.driver.name} ${row.operator_name} ${row.driver.vehicle_number} ${row.driver.languages}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  // Group by operator so the "who works for whom" structure is obvious.
  const byOperator = filtered.reduce<Record<string, DriverWithOperator[]>>((acc, row) => {
    (acc[row.operator_name] ??= []).push(row);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Our people"
        title="Tanker Drivers"
        subtitle="Every driver on the platform, the vehicle they run, and the operator they work under. Know who is coming before you book."
        action={
          <Button variant="secondary" onClick={useMyLocation} loading={locating}>
            <MapPin className="size-4" />
            Nearest to me
          </Button>
        }
      />

      <div className="card mb-6 flex flex-wrap items-center gap-3 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by driver, operator or vehicle number"
          aria-label="Search drivers"
          className={cx(inputClass, "min-w-52 flex-1")}
        />
        <select
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className={cx(inputClass, "w-auto min-w-44")}
          aria-label="Filter by vehicle capacity"
        >
          {CAPACITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Link href="/tankers">
          <Button>Book a tanker</Button>
        </Link>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-52 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-6" />}
          title="No drivers match that search"
          description="Try clearing the search box or widening the capacity filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setCapacity(0);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-900">{filtered.length}</span> driver
            {filtered.length === 1 ? "" : "s"} across{" "}
            <span className="font-semibold text-ink-900">{Object.keys(byOperator).length}</span>{" "}
            verified operators
          </p>

          {Object.entries(byOperator).map(([operator, drivers]) => (
            <section key={operator}>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-ink-100 pb-2">
                <span className="grid size-8 place-items-center rounded-lg bg-ink-900 text-white">
                  <Truck className="size-4" />
                </span>
                <h2 className="font-bold text-ink-900">{operator}</h2>
                {drivers[0].operator_verified && <VerifiedBadge />}
                <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                  <Star filled className="size-3.5 text-accent-500" />
                  {drivers[0].operator_rating.toFixed(1)}
                </span>
                <span className="ml-auto text-xs text-ink-400">
                  {drivers.length} driver{drivers.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {drivers.map((row) => (
                  <DriverCard key={row.driver.id} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="card mt-10 flex items-start gap-3 bg-brand-50/60 p-5">
        <Shield className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-ink-600">
          <span className="font-semibold text-ink-900">How drivers are vetted. </span>
          Every operator clears a KYC check before their fleet is listed, and each driver record
          carries a licence number and vehicle registration. Driver contact numbers are shown so
          you can confirm access, gate timings or parking directly. Ratings come from customers who
          completed a delivery with that driver.
        </p>
      </div>
    </div>
  );
}

function DriverCard({ row }: { row: DriverWithOperator }) {
  const { driver } = row;
  const initials = driver.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <article className="card p-4 transition-all hover:-translate-y-0.5 hover:shadow-(--shadow-lift)">
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
          {initials}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{driver.name}</h3>
            {driver.is_available ? (
              <Badge tone="success">Available</Badge>
            ) : (
              <Badge tone="neutral">On a trip</Badge>
            )}
          </div>

          <p className="mt-0.5 text-xs text-ink-500">
            Drives for <span className="font-medium text-ink-700">{row.operator_name}</span>
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Star filled className="size-3.5 text-accent-500" />
              <span className="font-semibold text-ink-900">{driver.rating.toFixed(1)}</span>
            </span>
            <span>{driver.trips_completed} trips</span>
            <span>{driver.experience_years} yrs experience</span>
            {row.distance_km !== null && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {row.distance_km} km
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-100 pt-3 text-xs">
        <Detail label="Vehicle" value={driver.vehicle_number} mono />
        <Detail label="Capacity" value={litres(driver.vehicle_capacity_l)} />
        <Detail label="Licence" value={driver.licence_number} mono />
        <Detail label="Languages" value={driver.languages} />
      </dl>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-2 text-xs text-ink-600">
        <Clock className="size-3.5 shrink-0 text-brand-500" />
        {driver.shift}
      </div>

      <div className="mt-3 flex gap-2">
        <a href={`tel:+91${driver.phone}`} className="flex-1">
          <Button variant="secondary" size="sm" fullWidth>
            <Phone className="size-4" />
            Call driver
          </Button>
        </a>
        <Link href="/tankers" className="flex-1">
          <Button size="sm" fullWidth>
            Book a trip
          </Button>
        </Link>
      </div>
    </article>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-ink-400">{label}</dt>
      <dd className={cx("truncate font-semibold text-ink-700", mono && "font-mono text-[11px]")}>
        {value}
      </dd>
    </div>
  );
}
