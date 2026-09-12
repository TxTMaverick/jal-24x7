"use client";

/**
 * Party and event booking.
 *
 * For a wedding or a function nobody wants to add cans to a cart. They want a
 * quantity worked out and a person to call. This page does both: a sizing
 * calculator, then the list of event desks near the venue.
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Calendar, Camper, Check, MapPin, Phone, Star, Truck, Building } from "@/components/icons";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  VerifiedBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, litres, money } from "@/lib/format";
import type { EventContact, EventSizing } from "@/lib/types";
import { useToast } from "@/store/toast";

const INDORE: [number, number] = [22.7196, 75.8577];

const OCCASIONS = [
  { key: "wedding", label: "Wedding", guests: 400, hours: 8, emoji: "💍" },
  { key: "birthday", label: "Birthday", guests: 60, hours: 4, emoji: "🎂" },
  { key: "corporate", label: "Corporate", guests: 150, hours: 6, emoji: "🏢" },
  { key: "religious", label: "Religious", guests: 250, hours: 5, emoji: "🪔" },
  { key: "housewarming", label: "Housewarming", guests: 80, hours: 5, emoji: "🏠" },
  { key: "other", label: "Something else", guests: 100, hours: 4, emoji: "🎉" },
];

export default function EventsPage() {
  const { toast, error: toastError } = useToast();

  const [occasion, setOccasion] = useState("wedding");
  const [guests, setGuests] = useState(400);
  const [hours, setHours] = useState(8);
  const [isSummer, setIsSummer] = useState(true);

  const [pin, setPin] = useState<[number, number]>(INDORE);
  const [locating, setLocating] = useState(false);

  const [sizing, setSizing] = useState<EventSizing | null>(null);
  const [contacts, setContacts] = useState<EventContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recompute the estimate whenever the inputs change.
  useEffect(() => {
    let cancelled = false;
    api
      .eventSizing({ guests, hours, is_summer: isSummer })
      .then((data) => {
        if (!cancelled) setSizing(data);
      })
      .catch(() => {
        if (!cancelled) setSizing(null);
      });
    return () => {
      cancelled = true;
    };
  }, [guests, hours, isSummer]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContacts(await api.eventContacts({ lat: pin[0], lng: pin[1], guests }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load event contacts.");
    } finally {
      setLoading(false);
    }
  }, [pin, guests]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const pickOccasion = (key: string) => {
    const match = OCCASIONS.find((o) => o.key === key);
    if (!match) return;
    setOccasion(key);
    setGuests(match.guests);
    setHours(match.hours);
  };

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
        toast("Showing event desks near your venue.", "success", "Location updated");
      },
      () => {
        setLocating(false);
        toastError("Could not read your location. Showing contacts around Indore.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Parties and functions"
        title="Event Water Booking"
        subtitle="Tell us the occasion and the headcount. We work out how much water you need and connect you to suppliers near the venue who run an event desk."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* ---------------- Calculator ---------------- */}
        <section className="card p-5 sm:p-6 lg:sticky lg:top-20">
          <h2 className="font-semibold text-ink-900">1. What is the occasion?</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {OCCASIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => pickOccasion(item.key)}
                aria-pressed={occasion === item.key}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all",
                  occasion === item.key
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                    : "border-ink-200 hover:border-brand-300",
                )}
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="text-center text-[11px] font-semibold leading-tight text-ink-900">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <h2 className="mt-6 font-semibold text-ink-900">2. How many guests?</h2>
          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600">Guests</span>
                <span className="text-lg font-bold tabular-nums text-brand-700">{guests}</span>
              </div>
              <input
                type="range"
                min={10}
                max={2000}
                step={10}
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="mt-1.5 w-full accent-brand-600"
                aria-label="Number of guests"
              />
              <div className="flex justify-between text-[11px] text-ink-400">
                <span>10</span>
                <span>2,000</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600">Duration</span>
                <span className="text-lg font-bold tabular-nums text-brand-700">{hours} hrs</span>
              </div>
              <input
                type="range"
                min={1}
                max={16}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="mt-1.5 w-full accent-brand-600"
                aria-label="Event duration in hours"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-accent-400/10 p-3">
              <input
                type="checkbox"
                checked={isSummer}
                onChange={(e) => setIsSummer(e.target.checked)}
                className="size-4 rounded border-ink-300 text-accent-500 focus:ring-accent-500"
              />
              <span className="text-sm text-ink-700">
                Summer function
                <span className="block text-xs text-ink-500">
                  Adds about 25 percent to the estimate
                </span>
              </span>
            </label>
          </div>

          {/* Result */}
          {sizing && (
            <div className="mt-6 rounded-2xl bg-ink-900 p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-ink-300">You will need about</p>
              <p className="mt-1 text-4xl font-bold">{litres(sizing.total_litres)}</p>
              <p className="mt-0.5 text-sm text-ink-300">of drinking water</p>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                <Figure value={sizing.campers_100l} label="100L campers" />
                <Figure value={sizing.cans_20l} label="20L cans" />
                <Figure value={sizing.bottles_1l} label="1L bottles" />
              </div>

              <p className="mt-4 text-[11px] leading-relaxed text-ink-400">{sizing.note}</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/products?category=camper" className="flex-1">
              <Button variant="secondary" fullWidth>
                <Camper className="size-4" />
                Order campers
              </Button>
            </Link>
            <Link href="/tankers" className="flex-1">
              <Button variant="secondary" fullWidth>
                <Truck className="size-4" />
                Add a tanker
              </Button>
            </Link>
          </div>
        </section>

        {/* ---------------- Contacts ---------------- */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">3. Book with a supplier</h2>
              <p className="mt-0.5 text-sm text-ink-500">
                Event desks near your venue, sized for {guests} guests.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={useMyLocation} loading={locating}>
              <MapPin className="size-4" />
              Venue location
            </Button>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => void loadContacts()} />
          ) : loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-44 rounded-2xl" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={<Calendar className="size-6" />}
              title="No event desks for that headcount nearby"
              description="Try a smaller guest count, or move the venue location. You can also order campers and tankers directly."
              action={
                <Link href="/products?category=camper">
                  <Button>Browse campers</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {contacts.map((contact) => (
                <ContactCard key={contact.vendor.id} contact={contact} />
              ))}
            </div>
          )}

          <div className="card mt-5 overflow-hidden">
            <div className="relative h-32">
              <Image
                src="/images/products/camper-party.jpg"
                alt="Chilled water campers set up at an event"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-r from-ink-900/85 to-ink-900/30" />
              <div className="absolute inset-y-0 left-0 flex max-w-xs flex-col justify-center p-5 text-white">
                <p className="font-bold">Large function coming up?</p>
                <p className="mt-1 text-xs text-white/85">
                  For 500 guests or more our team can plan campers, tankers and refills together.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm text-ink-600">Tell us the date and we will call you back.</p>
              <Link href="/contact">
                <Button size="sm">Talk to our team</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString("en-IN")}</p>
      <p className="text-[11px] text-ink-400">{label}</p>
    </div>
  );
}

function ContactCard({ contact }: { contact: EventContact }) {
  const { vendor } = contact;

  return (
    <article className="card p-4 transition-all hover:-translate-y-0.5 hover:shadow-(--shadow-lift)">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-accent-400 to-accent-600 text-white">
          <Building className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink-900">{vendor.name}</h3>
            {vendor.is_verified && <VerifiedBadge />}
          </div>
          <p className="mt-0.5 text-xs text-ink-500">{vendor.tagline}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1">
              <Star filled className="size-3.5 text-accent-500" />
              <span className="font-semibold text-ink-900">{vendor.rating.toFixed(1)}</span>
              <span className="text-ink-400">({vendor.rating_count})</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {contact.distance_km} km
            </span>
            <span>
              {contact.min_guests} to {contact.max_guests.toLocaleString("en-IN")} guests
            </span>
          </div>
        </div>
      </div>

      {/* The named person to speak to. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 p-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Event coordinator</p>
          <p className="truncate text-sm font-bold text-ink-900">{contact.contact_person}</p>
          <p className="text-xs text-ink-500">{contact.area}</p>
        </div>
        <a href={`tel:+91${contact.contact_phone}`}>
          <Button size="sm">
            <Phone className="size-4" />
            +91 {contact.contact_phone}
          </Button>
        </a>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-ink-100 pt-3 text-xs">
        <div>
          <dt className="text-ink-400">Suggested</dt>
          <dd className="font-semibold text-ink-900">{litres(contact.suggested_litres)}</dd>
        </div>
        <div>
          <dt className="text-ink-400">Campers</dt>
          <dd className="font-semibold text-ink-900">{contact.suggested_campers} × 100L</dd>
        </div>
        <div>
          <dt className="text-ink-400">Estimate</dt>
          <dd className="font-semibold text-brand-700">{money(contact.estimated_cost)}</dd>
        </div>
      </dl>

      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-ink-400">
        <Check className="mt-px size-3 shrink-0 text-success-500" strokeWidth={3} />
        Final quote is confirmed by the coordinator once the venue and timing are fixed.
      </p>
    </article>
  );
}
