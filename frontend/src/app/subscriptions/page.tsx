"use client";

/** Screen 5. Daily Camper Subscriptions & Society Tanker Delivery. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Building, Camper, Check, Home, Repeat, UserIcon } from "@/components/icons";
import {
  Badge,
  Button,
  ErrorState,
  Field,
  PageHeader,
  QuantityStepper,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, litres, money, relativeTime } from "@/lib/format";
import type { Product, Subscription, SubscriptionEstimate, TankerTier } from "@/lib/types";
import { useClientDate } from "@/lib/useClientDate";
import { useAuth } from "@/store/auth";
import { useToast } from "@/store/toast";

type PlanType = "camper" | "society_tanker";

const FREQUENCIES = [
  { key: "daily", label: "Every day", detail: "30 / month", save: "12% off" },
  { key: "alternate", label: "Alternate days", detail: "15 / month", save: "8% off" },
  { key: "weekly", label: "Weekly", detail: "4 / month", save: "5% off" },
  { key: "monthly", label: "Monthly", detail: "1 / month", save: "3% off" },
];

type Segment = "individual" | "family" | "society";

/**
 * Who the plan is for.
 *
 * This only sizes the plan and picks sensible defaults. The price always
 * comes from the product or tanker tier, never from the segment, so nobody
 * is charged more for ticking a different box.
 */
const SEGMENTS: {
  key: Segment;
  label: string;
  detail: string;
  icon: typeof Camper;
  quantity: number;
  frequency: string;
  plan: PlanType;
}[] = [
  {
    key: "individual",
    label: "Individual",
    detail: "One person, hostel room or desk",
    icon: UserIcon,
    quantity: 1,
    frequency: "weekly",
    plan: "camper",
  },
  {
    key: "family",
    label: "Family",
    detail: "A household of three to six",
    icon: Home,
    quantity: 2,
    frequency: "alternate",
    plan: "camper",
  },
  {
    key: "society",
    label: "Society",
    detail: "RWA, hostel, school or office block",
    icon: Building,
    quantity: 1,
    frequency: "weekly",
    plan: "society_tanker",
  },
];

const WINDOWS = ["06:00-08:00", "07:00-09:00", "09:00-11:00", "17:00-19:00", "19:00-21:00"];

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [plan, setPlan] = useState<PlanType>("camper");
  const [segment, setSegment] = useState<Segment>("family");
  const [campers, setCampers] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<TankerTier[]>([]);
  const [mine, setMine] = useState<Subscription[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Shared form state
  const [productId, setProductId] = useState<number | null>(null);
  const [tierId, setTierId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState("daily");
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [preferredWindow, setPreferredWindow] = useState(WINDOWS[1]);
  // Computed after mount, never while rendering: see useClientDate.
  const tomorrow = useClientDate(1);
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    if (tomorrow) setStartDate((current) => current || tomorrow);
  }, [tomorrow]);
  const [societyName, setSocietyName] = useState("");
  const [units, setUnits] = useState(60);

  const [estimate, setEstimate] = useState<SubscriptionEstimate | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load catalogue once.
  useEffect(() => {
    Promise.all([api.products({ category: "camper" }), api.tankers("society")])
      .then(([camperList, tierList]) => {
        setCampers(camperList);
        setTiers(tierList);
        setProductId(camperList[0]?.id ?? null);
        setTierId(tierList[0]?.id ?? null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load plans."));
  }, []);

  // Prefill contact details for a signed-in user.
  useEffect(() => {
    if (user) {
      setName((current) => current || user.name);
      setPhone((current) => current || user.phone);
    }
  }, [user]);

  const loadMine = useCallback(() => {
    if (!user) {
      setMine([]);
      return;
    }
    api
      .mySubscriptions()
      .then(setMine)
      .catch(() => setMine([]));
  }, [user]);

  useEffect(() => loadMine(), [loadMine]);

  // Live cost preview whenever the plan inputs change.
  useEffect(() => {
    const target = plan === "camper" ? productId : tierId;
    if (!target) {
      setEstimate(null);
      return;
    }
    let cancelled = false;
    api
      .subscriptionEstimate({
        plan_type: plan,
        frequency,
        quantity,
        product_id: plan === "camper" ? productId! : undefined,
        tanker_tier_id: plan === "society_tanker" ? tierId! : undefined,
      })
      .then((data) => {
        if (!cancelled) setEstimate(data);
      })
      .catch(() => {
        if (!cancelled) setEstimate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [plan, productId, tierId, frequency, quantity]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toastError("Please sign in to start a subscription.");
      return;
    }
    setSubmitting(true);
    try {
      await api.createSubscription({
        plan_type: plan,
        segment,
        frequency,
        quantity,
        product_id: plan === "camper" ? productId : null,
        tanker_tier_id: plan === "society_tanker" ? tierId : null,
        contact_name: name,
        contact_phone: phone,
        address_line: address,
        preferred_window: preferredWindow,
        start_date: startDate,
        society_name: plan === "society_tanker" ? societyName : null,
        units_count: plan === "society_tanker" ? units : null,
      });
      success(
        plan === "camper"
          ? "Your daily camper plan is active. First delivery starts on your chosen date."
          : "Society tanker contract created. Our team will confirm the schedule.",
        "Subscription created",
      );
      setAddress("");
      loadMine();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not create the subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-9">
        <ErrorState message={loadError} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Recurring delivery"
        title="Subscriptions & Society Contracts"
        subtitle="Set it once and stop reordering. Recurring plans are cheaper per delivery than one-off orders, and you can pause any time."
      />

      {/* Who is this for. Sizes the plan and picks the sensible defaults. */}
      <div className="mb-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
          Who is this plan for?
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SEGMENTS.map((option) => {
            const active = segment === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setSegment(option.key);
                  setPlan(option.plan);
                  setQuantity(option.quantity);
                  setFrequency(option.frequency);
                }}
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
                    "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
                    active ? "bg-brand-600 text-white" : "bg-ink-50 text-ink-500",
                  )}
                >
                  <option.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      "block text-sm font-semibold",
                      active ? "text-brand-700" : "text-ink-900",
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="block truncate text-xs text-ink-500">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan switch */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <PlanTab
          active={plan === "camper"}
          onClick={() => setPlan("camper")}
          icon={Camper}
          title="Daily Camper Plan"
          blurb="For homes and offices, a fresh camper delivered on your schedule."
          badge="Up to 12% off"
        />
        <PlanTab
          active={plan === "society_tanker"}
          onClick={() => setPlan("society_tanker")}
          icon={Building}
          title="Society Tanker Contract"
          blurb="For RWAs and institutions, recurring bulk tanker trips at contract rates."
          badge="Contract rate"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* ---------------- Form ---------------- */}
        <form onSubmit={handleSubmit} className="card space-y-5 p-5 sm:p-6">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              1. Choose what gets delivered
            </h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {plan === "camper"
                ? campers.map((product) => (
                    <OptionCard
                      key={product.id}
                      active={productId === product.id}
                      onClick={() => setProductId(product.id)}
                      title={product.name}
                      subtitle={`${litres(product.capacity_l)} · ${money(product.price)} each`}
                      emoji={product.image}
                    />
                  ))
                : tiers.map((tier) => (
                    <OptionCard
                      key={tier.id}
                      active={tierId === tier.id}
                      onClick={() => setTierId(tier.id)}
                      title={`${litres(tier.capacity_l)} Tanker`}
                      subtitle={`${money(tier.base_price)} per trip`}
                      emoji="🚛"
                    />
                  ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              2. How often?
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {FREQUENCIES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setFrequency(option.key)}
                  aria-pressed={frequency === option.key}
                  className={cx(
                    "rounded-xl border p-3 text-left transition-all",
                    frequency === option.key
                      ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                      : "border-ink-200 bg-white hover:border-brand-300",
                  )}
                >
                  <span className="block text-sm font-semibold text-ink-900">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-500">{option.detail}</span>
                  <Badge tone="success" className="mt-2">
                    {option.save}
                  </Badge>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 p-3">
              <span className="text-sm text-ink-700">
                {plan === "camper" ? "Campers per delivery" : "Tanker trips per delivery"}
              </span>
              <QuantityStepper value={quantity} onChange={setQuantity} max={plan === "camper" ? 20 : 10} />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              3. Where and when
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {plan === "society_tanker" && (
                <>
                  <Field label="Society / institution name" required>
                    <input
                      value={societyName}
                      onChange={(e) => setSocietyName(e.target.value)}
                      required
                      placeholder="e.g. Silver Springs RWA"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Number of flats / units" required>
                    <input
                      type="number"
                      min={1}
                      max={5000}
                      value={units}
                      onChange={(e) => setUnits(Number(e.target.value))}
                      required
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              <Field label="Contact name" required>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Full name"
                  className={inputClass}
                />
              </Field>

              <Field label="Mobile number" required hint="10-digit Indian mobile">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  inputMode="numeric"
                  placeholder="9876543210"
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Delivery address" required>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    minLength={4}
                    rows={2}
                    placeholder="Flat / block, street, area, landmark"
                    className={cx(inputClass, "h-auto py-2.5")}
                  />
                </Field>
              </div>

              <Field label="Preferred window" required>
                <select
                  value={preferredWindow}
                  onChange={(e) => setPreferredWindow(e.target.value)}
                  className={inputClass}
                >
                  {WINDOWS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Start date" required>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {!user && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-400/10 p-4">
              <p className="text-sm text-ink-700">Sign in to save this plan to your account.</p>
              <Link href="/login">
                <Button variant="accent" size="sm">
                  Sign in
                </Button>
              </Link>
            </div>
          )}

          <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!user}>
            <Repeat className="size-5" />
            {plan === "camper" ? "Start daily plan" : "Request society contract"}
          </Button>
        </form>

        {/* ---------------- Summary + existing plans ---------------- */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="font-semibold text-ink-900">Estimated monthly cost</h2>
            {estimate ? (
              <>
                <p className="mt-3 text-3xl font-bold text-brand-700">
                  {money(estimate.estimated_cycle_cost)}
                  <span className="ml-1 text-sm font-medium text-ink-400">/ month</span>
                </p>
                <dl className="mt-4 space-y-2 border-t border-ink-100 pt-3 text-sm">
                  <SummaryRow label="Rate per delivery" value={money(estimate.unit_price * estimate.quantity)} />
                  <SummaryRow
                    label="Deliveries per month"
                    value={String(estimate.deliveries_per_month)}
                  />
                  <SummaryRow label="Before discount" value={money(estimate.gross_cost)} />
                  <div className="flex justify-between text-success-600">
                    <dt>Recurring discount</dt>
                    <dd className="font-semibold">
                      −{money(estimate.savings)} ({Math.round(estimate.discount_rate * 100)}%)
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 rounded-lg bg-success-50 p-2.5 text-xs text-success-600">
                  You save <strong>{money(estimate.savings)}</strong> a month versus ordering each
                  delivery separately.
                </p>
              </>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="skeleton h-9 w-40 rounded" />
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-2/3 rounded" />
              </div>
            )}

            <ul className="mt-4 space-y-2 border-t border-ink-100 pt-3">
              {[
                "Pause or cancel any time",
                "Same verified suppliers as one-off orders",
                "Billed per delivery cycle, no lock-in",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs text-ink-600">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success-500" strokeWidth={3} />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink-900">My plans</h2>
              {mine.length > 0 && <Badge tone="brand">{mine.length}</Badge>}
            </div>

            {!user ? (
              <p className="mt-3 text-sm text-ink-500">Sign in to see your active plans.</p>
            ) : mine.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                No subscriptions yet. Create one on the left and it will appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {mine.map((sub) => (
                  <li key={sub.id} className="rounded-xl bg-ink-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {sub.plan_type === "camper"
                            ? `Daily camper × ${sub.quantity}`
                            : sub.society_name || "Society contract"}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {sub.frequency} · {sub.preferred_window} ·{" "}
                          {money(sub.estimated_cycle_cost)}/mo
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          Created {relativeTime(sub.created_at)}
                        </p>
                      </div>
                      <Badge tone={sub.status === "active" ? "success" : "neutral"}>
                        {sub.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1.5"
                      onClick={async () => {
                        try {
                          await api.pauseSubscription(sub.id);
                          loadMine();
                        } catch (e) {
                          toastError(e instanceof Error ? e.message : "Could not update the plan.");
                        }
                      }}
                    >
                      {sub.status === "active" ? "Pause plan" : "Resume plan"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PlanTab({
  active,
  onClick,
  icon: Icon,
  title,
  blurb,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Camper;
  title: string;
  blurb: string;
  badge: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "card flex items-start gap-3 p-4 text-left transition-all",
        active ? "ring-2 ring-brand-500 ring-offset-1" : "hover:-translate-y-0.5 hover:shadow-(--shadow-lift)",
      )}
    >
      <span
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
          active ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-600",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-900">{title}</span>
          <Badge tone="success">{badge}</Badge>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{blurb}</span>
      </span>
    </button>
  );
}

function OptionCard({
  active,
  onClick,
  title,
  subtitle,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
        active ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-ink-200 bg-white hover:border-brand-300",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-2xl shadow-sm">
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-900">{title}</span>
        <span className="block text-xs text-ink-500">{subtitle}</span>
      </span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-600">
      <dt>{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
