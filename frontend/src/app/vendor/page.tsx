"use client";

/** Screen 12. Vendor panel: assigned orders, status updates, own listing. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Check, Clock, MapPin, Shield, Truck } from "@/components/icons";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Rating,
  Stat,
  VerifiedBadge,
  inputClass,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, dateTime, eta, litres, money, statusLabel, statusTone } from "@/lib/format";
import type { Order, Vendor } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useToast } from "@/store/toast";

/** What a vendor can move an order to, given where it is now. */
const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: "confirmed", label: "Confirm order" }],
  confirmed: [{ status: "vendor_assigned", label: "Accept & prepare" }],
  vendor_assigned: [{ status: "out_for_delivery", label: "Start delivery" }],
  out_for_delivery: [{ status: "delivered", label: "Mark delivered" }],
};

export default function VendorPage() {
  const { user, loading: authLoading } = useAuth();
  const { success, error: toastError } = useToast();

  const [profile, setProfile] = useState<Vendor | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState("");
  const [minCap, setMinCap] = useState("");
  const [maxCap, setMaxCap] = useState("");

  const load = useCallback(async () => {
    if (!user || (user.role !== "vendor" && user.role !== "admin")) return;
    setError(null);
    try {
      const [me, list] = await Promise.all([api.vendorProfile(), api.vendorOrders()]);
      setProfile(me);
      setOrders(list);
      setPrice(String(me.price_per_trip));
      setSlots(String(me.capacity_per_slot));
      setMinCap(String(me.min_capacity_l));
      setMaxCap(String(me.max_capacity_l));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the vendor panel.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const advance = async (code: string, status: string, label: string) => {
    setBusyCode(code);
    try {
      await api.updateOrderStatus(code, status, `${label} by supplier.`);
      success(`Order ${code} → ${statusLabel(status)}. The customer sees this live.`);
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not update the order.");
    } finally {
      setBusyCode(null);
    }
  };

  const toggleOnline = async () => {
    if (!profile) return;
    try {
      const updated = await api.updateVendorProfile({ is_online: !profile.is_online });
      setProfile(updated);
      success(updated.is_online ? "You are online and accepting orders." : "You are now offline.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not change availability.");
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.updateVendorProfile({
        price_per_trip: Number(price),
        capacity_per_slot: Number(slots),
        min_capacity_l: Number(minCap),
        max_capacity_l: Number(maxCap),
      });
      setProfile(updated);
      success("Listing updated. Customers see the new rate immediately.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not save your listing.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="skeleton h-8 w-56 rounded" />
      </div>
    );
  }

  if (!user || (user.role !== "vendor" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Truck className="size-6" />}
          title="Vendor access required"
          description="Sign in with a supplier account to see assigned orders, update delivery status and manage your listing."
          action={
            <Link href="/login?next=/vendor">
              <Button>Sign in as vendor</Button>
            </Link>
          }
        />
        <p className="mt-4 text-center text-xs text-ink-400">
          Demo vendor: <span className="font-mono font-semibold">9822001133</span> (Indore Aqua
          Care)
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  const activeOrders = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const doneOrders = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));
  const earned = orders
    .filter((o) => o.status === "delivered")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Supplier"
        title={profile?.name ?? "Vendor Panel"}
        subtitle="Your assigned deliveries, live status control, and the listing customers see on the marketplace."
        action={
          profile && (
            <Button variant={profile.is_online ? "secondary" : "primary"} size="sm" onClick={toggleOnline}>
              <span
                className={cx(
                  "size-2 rounded-full",
                  profile.is_online ? "bg-success-500" : "bg-ink-300",
                )}
              />
              {profile.is_online ? "Online, accepting orders" : "Offline"}
            </Button>
          )
        }
      />

      {profile && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active jobs" value={activeOrders.length} tone="accent" />
            <Stat label="Completed" value={profile.completed_orders} tone="success" />
            <Stat label="Earned here" value={money(earned)} />
            <Stat
              label="Rating"
              value={profile.rating.toFixed(1)}
              hint={`${profile.rating_count} ratings`}
              tone="brand"
            />
          </div>

          <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-sm">
            {profile.is_verified ? <VerifiedBadge /> : <Badge tone="warn">KYC {profile.kyc_status}</Badge>}
            <Rating value={profile.rating} count={profile.rating_count} />
            <span className="inline-flex items-center gap-1.5 text-ink-500">
              <MapPin className="size-4" />
              Zones {profile.service_zones || "-"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-500">
              <Shield className="size-4 text-success-500" />
              {profile.certifications}
            </span>
            <span className="ml-auto text-ink-500">
              Load {profile.active_load}/{profile.capacity_per_slot} slots
            </span>
          </div>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* Assigned orders */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-500">
            Active deliveries ({activeOrders.length})
          </h2>

          {activeOrders.length === 0 ? (
            <EmptyState
              icon={<Check className="size-6" />}
              title="Nothing pending"
              description="New orders matched to you will appear here automatically."
            />
          ) : (
            <ul className="space-y-3">
              {activeOrders.map((order) => (
                <li key={order.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ink-900">
                          {order.order_code}
                        </span>
                        <span
                          className={cx(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                            statusTone(order.status),
                          )}
                        >
                          {statusLabel(order.status)}
                        </span>
                        {order.is_express && <Badge tone="warn">Express</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink-900">{order.contact_name}</p>
                      <p className="text-xs text-ink-500">+91 {order.contact_phone}</p>
                    </div>
                    <p className="text-lg font-bold text-ink-900">{money(order.total)}</p>
                  </div>

                  <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span className="font-medium text-ink-900">{item.quantity}×</span>{" "}
                        {item.name}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2.5 flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-ink-100 pt-2.5 text-xs text-ink-500">
                    <span className="inline-flex items-start gap-1">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      <span className="max-w-64">
                        {order.address_line}, {order.address_city} {order.address_pincode}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      ETA {eta(order.eta_minutes)}
                    </span>
                    {order.delivery_slot && <span>{order.delivery_slot}</span>}
                  </div>

                  {order.notes && (
                    <p className="mt-2 rounded-lg bg-accent-400/10 p-2 text-xs text-ink-700">
                      Note: {order.notes}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(NEXT_STATUS[order.status] ?? []).map((next) => (
                      <Button
                        key={next.status}
                        size="sm"
                        loading={busyCode === order.order_code}
                        onClick={() => void advance(order.order_code, next.status, next.label)}
                      >
                        {next.label} →
                      </Button>
                    ))}
                    <Link href={`/track/${order.order_code}`}>
                      <Button size="sm" variant="secondary">
                        View tracking
                      </Button>
                    </Link>
                    <a href={`tel:+91${order.contact_phone}`}>
                      <Button size="sm" variant="ghost">
                        Call customer
                      </Button>
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {doneOrders.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-500">
                Completed ({doneOrders.length})
              </h2>
              <ul className="space-y-2">
                {doneOrders.slice(0, 10).map((order) => (
                  <li
                    key={order.id}
                    className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                  >
                    <span className="font-mono font-semibold text-ink-700">{order.order_code}</span>
                    <span className="text-ink-500">{order.contact_name}</span>
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                        statusTone(order.status),
                      )}
                    >
                      {statusLabel(order.status)}
                    </span>
                    <span className="text-xs text-ink-400">{dateTime(order.updated_at)}</span>
                    <span className="font-semibold text-ink-900">{money(order.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Listing management */}
        <aside className="lg:sticky lg:top-20">
          <form onSubmit={saveProfile} className="card space-y-4 p-5">
            <div>
              <h2 className="font-semibold text-ink-900">My listing</h2>
              <p className="mt-1 text-xs text-ink-500">
                What customers see when they compare suppliers on the marketplace.
              </p>
            </div>

            <Field label="Price per trip (₹)" required>
              <input
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Min capacity (L)">
                <input
                  type="number"
                  min={0}
                  value={minCap}
                  onChange={(e) => setMinCap(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Max capacity (L)">
                <input
                  type="number"
                  min={0}
                  value={maxCap}
                  onChange={(e) => setMaxCap(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="Deliveries per slot"
              hint="Used by the matching engine, a busier vendor ranks lower"
            >
              <input
                type="number"
                min={1}
                max={100}
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Button type="submit" fullWidth loading={savingProfile}>
              Save listing
            </Button>

            {profile && (
              <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
                <p className="font-semibold text-ink-900">Capacity range preview</p>
                <p className="mt-1">
                  You will be matched to orders between {litres(Number(minCap) || 0)} and{" "}
                  {litres(Number(maxCap) || 0)}.
                </p>
              </div>
            )}
          </form>
        </aside>
      </div>
    </div>
  );
}
