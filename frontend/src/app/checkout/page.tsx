"use client";

/**
 * Screen 6 (part 2) + Screen 7 (part 2). Checkout.
 *
 * Address with a map pin drop, delivery slot, payment method, and a live
 * server-computed order summary. Requires a verified session, so an anonymous
 * visitor is routed through /login first.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import DynamicMap, { type MapMarker } from "@/components/DynamicMap";
import { PaymentSheet } from "@/components/PaymentSheet";
import { Check, Clock, MapPin, Shield, Truck } from "@/components/icons";
import { Badge, Button, Field, PageHeader, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { EXPRESS_DELIVERY_FEE } from "@/lib/pricing";
import { cx, litres, money } from "@/lib/format";
import { clearSchedule, readSchedule, scheduleToISO } from "@/lib/schedule";
import type { PayResult, Quote } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";

const DEFAULT_PIN: [number, number] = [22.7196, 75.8577];

const SLOTS = [
  "Today, 6-8 PM",
  "Today, 8-10 PM",
  "Tomorrow, 7-9 AM",
  "Tomorrow, 10 AM-12 PM",
  "Tomorrow, 4-6 PM",
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { items, hydrated, hasTanker, toLines, clear } = useCart();
  const { success, error: toastError } = useToast();

  const [pin, setPin] = useState<[number, number]>(DEFAULT_PIN);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [pincode, setPincode] = useState("452001");
  const [city, setCity] = useState("Indore");
  const [slot, setSlot] = useState(SLOTS[0]);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [isExpress, setIsExpress] = useState(false);
  const [isSociety, setIsSociety] = useState(false);
  const [notes, setNotes] = useState("");

  // The payment sheet opens only after the order row exists, so a failed
  // payment leaves a recoverable pending order rather than losing the cart.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [placing, setPlacing] = useState(false);
  const [locating, setLocating] = useState(false);

  // Send anonymous visitors through OTP verification first (Screen 7).
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?next=/checkout");
  }, [authLoading, user, router]);

  // Empty cart? Nothing to check out.
  useEffect(() => {
    if (hydrated && items.length === 0) router.replace("/cart");
  }, [hydrated, items.length, router]);

  useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setPhone((current) => current || user.phone);
    }
  }, [user]);

  // Pick up a slot chosen on the Tankers screen.
  useEffect(() => {
    const saved = readSchedule();
    if (saved && hasTanker) {
      setSlot(`${saved.date} · ${saved.window}`);
      setScheduledFor(scheduleToISO(saved));
    }
  }, [hasTanker]);

  // Re-price whenever the pin, express flag or society flag changes.
  const refreshQuote = useCallback(async () => {
    if (items.length === 0) return;
    try {
      setQuote(
        await api.quote({
          lines: toLines(),
          lat: pin[0],
          lng: pin[1],
          is_express: isExpress,
          is_society: hasTanker && isSociety,
        }),
      );
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not price this order.");
    }
  }, [items.length, toLines, pin, isExpress, isSociety, hasTanker, toastError]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshQuote();
  }, [hydrated, refreshQuote]);

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
        success("Delivery pin set to your current location.");
      },
      () => {
        setLocating(false);
        toastError("Could not read your location. Tap the map to drop a pin instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const markers = useMemo<MapMarker[]>(
    () => [
      {
        id: "delivery",
        lat: pin[0],
        lng: pin[1],
        kind: "customer",
        label: "Delivery location",
        sublabel: `${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}`,
        active: true,
      },
    ],
    [pin],
  );

  /** Step one: create the order, then hand over to the payment sheet. */
  const placeOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setPlacing(true);
    try {
      const order = await api.createOrder({
        lines: toLines(),
        order_type: hasTanker ? "tanker" : "products",
        contact_name: name,
        contact_phone: phone,
        address_line: line1,
        address_city: city,
        address_pincode: pincode,
        address_lat: pin[0],
        address_lng: pin[1],
        delivery_slot: slot,
        scheduled_for: scheduledFor,
        is_express: isExpress,
        is_society: hasTanker && isSociety,
        notes: notes || null,
      });
      setPendingCode(order.order_code);
      setSheetOpen(true);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not place the order.");
    } finally {
      setPlacing(false);
    }
  };

  /** Step two: the sheet reports a successful payment. */
  const handlePaid = (result: PayResult) => {
    clear();
    clearSchedule();
    setSheetOpen(false);
    success(
      `Paid ${result.method_label}. Order ${result.order.order_code} is confirmed.`,
      "Payment successful",
    );
    router.push(`/track/${result.order.order_code}`);
  };

  if (authLoading || !hydrated || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div className="skeleton h-[32rem] rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Checkout"
        title="Confirm & Pay"
        subtitle="Drop your delivery pin, pick a slot, and we will match the nearest verified supplier automatically."
      />

      <form onSubmit={placeOrder} className="grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          {/* --- Delivery location --- */}
          <section className="card p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-ink-900">1. Delivery location</h2>
              <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} loading={locating}>
                <MapPin className="size-4" />
                Use my location
              </Button>
            </div>

            <DynamicMap
              markers={markers}
              center={pin}
              zoom={14}
              className="h-56 sm:h-64"
              onPick={(lat, lng) => setPin([lat, lng])}
            />
            <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
              <MapPin className="size-3.5" />
              Tap anywhere on the map to move your delivery pin · {pin[0].toFixed(5)},{" "}
              {pin[1].toFixed(5)}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  className={inputClass}
                />
              </Field>
              <Field label="Mobile number" required>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Flat / house, street, area" required>
                  <textarea
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    required
                    minLength={4}
                    rows={2}
                    placeholder="e.g. 12, Scheme No. 54, Vijay Nagar, near C21 Mall"
                    className={cx(inputClass, "h-auto py-2.5")}
                  />
                </Field>
              </div>
              <Field label="City" required>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
              <Field label="PIN code" required hint="6 digits">
                <input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  pattern="\d{6}"
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* --- Slot --- */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900">2. Delivery slot</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              {(hasTanker && scheduledFor ? [slot, ...SLOTS] : SLOTS).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSlot(option)}
                  aria-pressed={slot === option}
                  className={cx(
                    "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                    slot === option
                      ? "bg-brand-600 text-white"
                      : "bg-ink-50 text-ink-600 hover:bg-brand-50 hover:text-brand-700",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>

            {!hasTanker && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-accent-400/10 p-3">
                <input
                  type="checkbox"
                  checked={isExpress}
                  onChange={(e) => setIsExpress(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                />
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Clock className="size-4 text-accent-600" />
                    Express delivery
                    <Badge tone="warn">+{money(EXPRESS_DELIVERY_FEE)}</Badge>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    Priority dispatch. Your order is put at the front of the queue.
                  </span>
                </span>
              </label>
            )}

            {hasTanker && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-brand-50 p-3">
                <input
                  type="checkbox"
                  checked={isSociety}
                  onChange={(e) => setIsSociety(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Truck className="size-4 text-brand-600" />
                    This is a society / institutional booking
                    <Badge tone="success">−8%</Badge>
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-500">
                    Applies the society contract rate instead of the individual spot rate.
                  </span>
                </span>
              </label>
            )}

            <Field label="Delivery notes (optional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, floor, who to call on arrival…"
                className={cx(inputClass, "mt-3")}
              />
            </Field>
          </section>

          {/* --- Payment --- */}
          <section className="card p-5">
            <h2 className="font-semibold text-ink-900">3. Payment</h2>
            <p className="mt-1 text-sm text-ink-500">
              Choose how to pay on the next step. UPI apps, cards, net banking and cash on
              delivery are all supported.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Google Pay", "PhonePe", "Paytm", "UPI ID", "Cards", "Net Banking", "Cash on Delivery"].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs font-medium text-ink-600"
                  >
                    {label}
                  </span>
                ),
              )}
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-lg bg-ink-50 p-2.5 text-[11px] leading-relaxed text-ink-500">
              <Shield className="mt-0.5 size-3.5 shrink-0 text-success-500" />
              This build runs in test mode. No card is charged and no real money moves. A
              production deployment would verify the gateway signature on the server before
              marking an order paid.
            </p>
          </section>
        </div>

        {/* --- Summary --- */}
        <aside className="card sticky top-20 p-5">
          <h2 className="font-semibold text-ink-900">Order summary</h2>

          <ul className="mt-3 space-y-2 border-b border-ink-100 pb-3">
            {items.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-2 text-sm">
                <span className="min-w-0 text-ink-600">
                  <span className="mr-1.5">{item.image}</span>
                  <span className="font-medium text-ink-900">{item.quantity}×</span>{" "}
                  {item.name}
                </span>
                <span className="shrink-0 font-semibold text-ink-900">
                  {money(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {quote ? (
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Subtotal" value={money(quote.subtotal, true)} />
              {quote.discount > 0 && (
                <div className="flex justify-between text-success-600">
                  <dt>{quote.discount_label || "Discount"}</dt>
                  <dd className="font-semibold">−{money(quote.discount, true)}</dd>
                </div>
              )}
              {quote.distance_surcharge > 0 && (
                <Row
                  label={`Distance surcharge (${quote.distance_km.toFixed(1)} km)`}
                  value={money(quote.distance_surcharge, true)}
                />
              )}
              <Row
                label="Delivery"
                value={quote.delivery_fee === 0 ? "FREE" : money(quote.delivery_fee, true)}
                tone={quote.delivery_fee === 0 ? "success" : undefined}
              />
              <Row label="GST (nil-rated)" value={money(quote.tax, true)} />
              <div className="flex items-end justify-between border-t border-ink-100 pt-3">
                <dt className="font-semibold text-ink-900">Total payable</dt>
                <dd className="text-2xl font-bold text-ink-900">{money(quote.total, true)}</dd>
              </div>
              <p className="text-xs text-ink-400">
                {litres(quote.total_litres)} of water · delivering to {city} {pincode}
              </p>
            </dl>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton h-8 w-full rounded" />
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            fullWidth
            className="mt-5"
            loading={placing}
            disabled={!quote || !line1}
          >
            <Check className="size-5" strokeWidth={3} />
            Continue to payment {quote ? money(quote.total) : ""}
          </Button>

          <Link href="/cart" className="mt-2 block">
            <Button type="button" variant="ghost" size="sm" fullWidth>
              ← Back to cart
            </Button>
          </Link>
        </aside>
      </form>

      <PaymentSheet
        open={sheetOpen}
        orderCode={pendingCode ?? ""}
        amount={quote?.total ?? 0}
        onClose={() => setSheetOpen(false)}
        onPaid={handlePaid}
      />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between text-ink-600">
      <dt>{label}</dt>
      <dd className={tone === "success" ? "font-semibold text-success-600" : "font-semibold text-ink-900"}>
        {value}
      </dd>
    </div>
  );
}
