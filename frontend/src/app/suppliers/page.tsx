"use client";

/** Screen 4. Water Suppliers Near You (marketplace + Leaflet map). */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import DynamicMap, { type MapMarker } from "@/components/DynamicMap";
import { Check, Clock, MapPin, Phone, Shield, Truck } from "@/components/icons";

import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Rating,
  VerifiedBadge,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, eta, litres, money } from "@/lib/format";
import type { VendorMatch } from "@/lib/types";
import { useToast } from "@/store/toast";

/** Rajwada, Indore. the fallback pin when geolocation is unavailable. */
const DEFAULT_PIN: [number, number] = [22.7196, 75.8577];

const SORTS = [
  { key: "best", label: "Best match" },
  { key: "nearest", label: "Nearest first" },
  { key: "price", label: "Lowest price" },
  { key: "rating", label: "Highest rated" },
] as const;

export default function SuppliersPage() {
  const { toast, error: toastError } = useToast();

  const [pin, setPin] = useState<[number, number]>(DEFAULT_PIN);
  const [locating, setLocating] = useState(false);
  const [usingRealLocation, setUsingRealLocation] = useState(false);

  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("best");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [tankersOnly, setTankersOnly] = useState(false);
  const [radius, setRadius] = useState(25);

  const [matches, setMatches] = useState<VendorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.nearbyVendors({
        lat: pin[0],
        lng: pin[1],
        radius_km: radius,
        verified_only: verifiedOnly,
        needs_tanker: tankersOnly,
        sort,
      });
      setMatches(data);
      setSelectedId(data[0]?.vendor.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [pin, radius, verifiedOnly, tankersOnly, sort]);

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
        setUsingRealLocation(true);
        setLocating(false);
        toast("Showing suppliers around your current location.", "success", "Location updated");
      },
      () => {
        setLocating(false);
        toastError(
          "Could not get your location. Showing suppliers around Indore city centre instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = [
      {
        id: "me",
        lat: pin[0],
        lng: pin[1],
        kind: "customer",
        label: "Your location",
        sublabel: usingRealLocation ? "From your device" : "Indore city centre (default)",
      },
    ];
    for (const match of matches) {
      list.push({
        id: match.vendor.id,
        lat: match.vendor.lat,
        lng: match.vendor.lng,
        kind: "vendor",
        label: match.vendor.name,
        sublabel: `${match.distance_km} km · ${money(match.vendor.price_per_trip)}/trip · ★ ${match.vendor.rating}`,
        active: match.vendor.id === selectedId,
        onSelect: () => setSelectedId(match.vendor.id),
      });
    }
    return list;
  }, [matches, pin, selectedId, usingRealLocation]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Marketplace"
        title="Water Suppliers Near You"
        subtitle="Compare verified private tanker operators and water suppliers side by side, price, capacity, rating and distance, all in one view."
        action={
          <Button variant="secondary" onClick={useMyLocation} loading={locating}>
            <MapPin className="size-4" />
            Use my location
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="card mb-5 flex flex-wrap items-center gap-3 p-3">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={cx(inputClass, "w-auto min-w-40")}
          aria-label="Sort suppliers"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Verified only
        </label>

        <label className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={tankersOnly}
            onChange={(e) => setTankersOnly(e.target.checked)}
            className="size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          Tanker operators
        </label>

        <label className="flex flex-1 items-center gap-3 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700 sm:max-w-64">
          <span className="shrink-0 text-xs font-medium">Radius</span>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="flex-1 accent-brand-600"
            aria-label="Search radius in kilometres"
          />
          <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-900">
            {radius} km
          </span>
        </label>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          {/* Supplier list */}
          <section className="order-2 lg:order-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="skeleton h-40 rounded-2xl" />
                ))}
              </div>
            ) : matches.length === 0 ? (
              <EmptyState
                icon={<Truck className="size-6" />}
                title="No suppliers in range"
                description="Try widening the radius, or turning off the 'verified only' filter to see newly registered operators."
                action={
                  <Button variant="secondary" onClick={() => setRadius(50)}>
                    Widen to 50 km
                  </Button>
                }
              />
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-500">
                  <span className="font-semibold text-ink-900">{matches.length}</span> supplier
                  {matches.length === 1 ? "" : "s"} within {radius} km
                </p>
                <div className="space-y-3">
                  {matches.map((match) => (
                    <SupplierCard
                      key={match.vendor.id}
                      match={match}
                      selected={match.vendor.id === selectedId}
                      onSelect={() => setSelectedId(match.vendor.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Map */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-20">
            <DynamicMap
              markers={markers}
              center={pin}
              zoom={12}
              className="h-72 sm:h-96 lg:h-[34rem]"
            />
            <div className="card mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 p-3 text-xs text-ink-500">
              <LegendDot color="#1f80f0" label="You" />
              <LegendDot color="#0f2540" label="Supplier" />
              <span className="ml-auto">Map data © OpenStreetMap contributors</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-full ring-2 ring-white"
        style={{ background: color, boxShadow: `0 0 0 3px ${color}33` }}
      />
      {label}
    </span>
  );
}

function SupplierCard({
  match,
  selected,
  onSelect,
}: {
  match: VendorMatch;
  selected: boolean;
  onSelect: () => void;
}) {
  const { vendor } = match;

  return (
    <article
      onClick={onSelect}
      className={cx(
        "card cursor-pointer p-4 transition-all",
        selected
          ? "ring-2 ring-brand-500 ring-offset-1"
          : "hover:-translate-y-0.5 hover:shadow-(--shadow-lift)",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
          <Truck className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{vendor.name}</h3>
            {vendor.is_verified && <VerifiedBadge />}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{vendor.tagline}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <Rating value={vendor.rating} count={vendor.rating_count} />
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {match.distance_km} km
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {eta(match.eta_minutes)}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-brand-700">{money(vendor.price_per_trip)}</p>
          <p className="text-[11px] text-ink-400">per trip</p>
        </div>
      </div>

      {/* Why this supplier ranked here, the matching engine's reasoning. */}
      {match.reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {match.reasons.slice(0, 3).map((reason) => (
            <li
              key={reason}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700"
            >
              <Check className="size-3" strokeWidth={3} />
              {reason}
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3 text-xs sm:grid-cols-4">
        <Detail label="Capacity" value={`${litres(vendor.min_capacity_l)}-${litres(vendor.max_capacity_l)}`} />
        <Detail label="Zones" value={vendor.service_zones || "-"} />
        <Detail label="Orders" value={vendor.completed_orders.toLocaleString("en-IN")} />
        <Detail label="Source" value={vendor.water_source} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/tankers?vendor=${vendor.id}`} className="flex-1">
          <Button fullWidth size="sm">
            Book This Vendor
          </Button>
        </Link>
        <a href={`tel:+91${vendor.phone}`} onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="sm">
            <Phone className="size-4" />
            Call
          </Button>
        </a>
      </div>

      {vendor.certifications && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-ink-400">
          <Shield className="size-3.5 text-success-500" />
          {vendor.certifications}
          {vendor.last_tested_on && <> · last tested {vendor.last_tested_on}</>}
        </p>
      )}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-400">{label}</dt>
      <dd className="truncate font-semibold text-ink-700">{value}</dd>
    </div>
  );
}
