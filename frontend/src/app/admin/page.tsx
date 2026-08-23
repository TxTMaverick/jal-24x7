"use client";

/** Screen 11. Admin dashboard: analytics, vendor KYC, order oversight. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Chart, Check, Close, Shield, Truck } from "@/components/icons";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  Rating,
  Stat,
  VerifiedBadge,
} from "@/components/ui";
import { api } from "@/lib/api";
import { cx, dateTime, litres, money, statusLabel, statusTone } from "@/lib/format";
import type { AdminStats, Order, Vendor } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useToast } from "@/store/toast";

type Tab = "overview" | "orders" | "vendors";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setError(null);
    try {
      const [s, o, v] = await Promise.all([api.adminStats(), api.adminOrders(), api.adminVendors()]);
      setStats(s);
      setOrders(o);
      setVendors(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the dashboard.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (vendorId: number, decision: "approve" | "reject") => {
    setBusyId(vendorId);
    try {
      await api.decideKyc(vendorId, decision);
      success(
        decision === "approve"
          ? "Vendor approved and now listed on the marketplace."
          : "Vendor rejected and delisted.",
      );
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not update KYC.");
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="skeleton h-8 w-56 rounded" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<Shield className="size-6" />}
          title="Admin access required"
          description="Sign in with an admin account to view platform analytics, approve vendors and monitor orders."
          action={
            <Link href="/login?next=/admin">
              <Button>Sign in as admin</Button>
            </Link>
          }
        />
        <p className="mt-4 text-center text-xs text-ink-400">
          Demo admin: <span className="font-mono font-semibold">9999900000</span>
        </p>
      </div>
    );
  }

  const pendingVendors = vendors.filter((v) => v.kyc_status === "pending");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Platform"
        title="Admin Dashboard"
        subtitle="Demand and supply across the service area, vendor verification, and every order on the platform."
        action={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["overview", "Overview"],
            ["orders", `Orders${orders.length ? ` (${orders.length})` : ""}`],
            ["vendors", `Vendors${pendingVendors.length ? ` · ${pendingVendors.length} pending` : ""}`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cx(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === key
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      ) : tab === "overview" ? (
        <Overview stats={stats} />
      ) : tab === "orders" ? (
        <OrdersTable orders={orders} />
      ) : (
        <VendorsTable vendors={vendors} busyId={busyId} onDecide={decide} />
      )}
    </div>
  );
}

function Overview({ stats }: { stats: AdminStats }) {
  const demandMax = Math.max(1, ...Object.values(stats.demand_by_service));
  const revenueMax = Math.max(1, ...stats.revenue_last_7_days.map((d) => d.revenue));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total orders" value={stats.total_orders} hint="All time" />
        <Stat label="Active orders" value={stats.active_orders} tone="accent" hint="In progress now" />
        <Stat label="Delivered today" value={stats.delivered_today} tone="success" />
        <Stat label="Revenue" value={money(stats.total_revenue)} hint="Paid orders" />
        <Stat label="Vendors" value={stats.vendors_total} hint={`${stats.vendors_online} online`} />
        <Stat
          label="Pending KYC"
          value={stats.vendors_pending_kyc}
          tone={stats.vendors_pending_kyc > 0 ? "accent" : "neutral"}
          hint="Awaiting approval"
        />
        <Stat label="Water delivered" value={litres(stats.total_litres_delivered)} tone="brand" />
        <Stat
          label="Completion rate"
          value={
            stats.total_orders
              ? `${Math.round(((stats.orders_by_status.delivered ?? 0) / stats.total_orders) * 100)}%`
              : "-"
          }
          tone="success"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Demand by service */}
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <Chart className="size-5 text-brand-600" />
            <h2 className="font-semibold text-ink-900">Demand by service</h2>
          </div>
          <div className="mt-4 space-y-3">
            {(
              [
                ["tanker", "Tanker", "bg-brand-600"],
                ["bottled", "Bottled", "bg-brand-400"],
                ["camper", "Camper", "bg-accent-500"],
              ] as const
            ).map(([key, label, colour]) => {
              const value = stats.demand_by_service[key] ?? 0;
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-600">{label}</span>
                    <span className="font-semibold tabular-nums text-ink-900">{value} units</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={cx("h-full rounded-full transition-all duration-500", colour)}
                      style={{ width: `${Math.max(2, (value / demandMax) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders by status */}
        <div className="card p-5">
          <h2 className="font-semibold text-ink-900">Orders by status</h2>
          <div className="mt-4 space-y-2">
            {Object.entries(stats.orders_by_status).length === 0 ? (
              <p className="text-sm text-ink-400">No orders yet.</p>
            ) : (
              Object.entries(stats.orders_by_status)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span
                      className={cx(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                        statusTone(status),
                      )}
                    >
                      {statusLabel(status)}
                    </span>
                    <span className="font-bold tabular-nums text-ink-900">{count}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900">Revenue, last 7 days</h2>
        <div className="mt-5 flex h-40 items-end gap-2">
          {stats.revenue_last_7_days.map((day) => (
            <div key={day.date} className="group flex flex-1 flex-col items-center gap-2">
              <span className="text-[10px] font-semibold text-ink-500 opacity-0 transition-opacity group-hover:opacity-100">
                {money(day.revenue)}
              </span>
              <div
                className="w-full rounded-t-lg bg-linear-to-t from-brand-500 to-brand-400 transition-all duration-500 hover:from-brand-600 hover:to-brand-500"
                style={{ height: `${Math.max(3, (day.revenue / revenueMax) * 100)}%` }}
                title={`${day.date}: ${money(day.revenue)}`}
              />
              <span className="text-[10px] text-ink-400">
                {new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <EmptyState icon={<Truck className="size-6" />} title="No orders on the platform yet" />;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th>Vendor</Th>
            <Th>Status</Th>
            <Th className="text-right">Total</Th>
            <Th>Placed</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {orders.map((order) => (
            <tr key={order.id} className="transition-colors hover:bg-brand-50/40">
              <td className="px-4 py-3">
                <Link
                  href={`/track/${order.order_code}`}
                  className="font-mono font-semibold text-brand-600 hover:text-brand-700"
                >
                  {order.order_code}
                </Link>
                <p className="text-xs text-ink-400">
                  {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                  {order.order_type}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-ink-900">{order.contact_name}</p>
                <p className="text-xs text-ink-400">+91 {order.contact_phone}</p>
              </td>
              <td className="px-4 py-3 text-ink-600">{order.vendor?.name ?? "-"}</td>
              <td className="px-4 py-3">
                <span
                  className={cx(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                    statusTone(order.status),
                  )}
                >
                  {statusLabel(order.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink-900">
                {money(order.total)}
              </td>
              <td className="px-4 py-3 text-xs text-ink-400">{dateTime(order.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorsTable({
  vendors,
  busyId,
  onDecide,
}: {
  vendors: Vendor[];
  busyId: number | null;
  onDecide: (id: number, decision: "approve" | "reject") => void;
}) {
  if (vendors.length === 0) {
    return <EmptyState icon={<Truck className="size-6" />} title="No vendors registered yet" />;
  }
  return (
    <div className="space-y-3">
      {vendors.map((vendor) => (
        <article key={vendor.id} className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
                <Truck className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink-900">{vendor.name}</h3>
                  {vendor.is_verified ? (
                    <VerifiedBadge />
                  ) : (
                    <Badge tone={vendor.kyc_status === "rejected" ? "danger" : "warn"}>
                      KYC {vendor.kyc_status}
                    </Badge>
                  )}
                  {vendor.is_online && <Badge tone="neutral">Online</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-ink-500">{vendor.tagline}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                  <Rating value={vendor.rating} count={vendor.rating_count} />
                  <span>+91 {vendor.phone}</span>
                  <span>Zones {vendor.service_zones || "-"}</span>
                  <span>
                    {litres(vendor.min_capacity_l)}-{litres(vendor.max_capacity_l)}
                  </span>
                  <span>{money(vendor.price_per_trip)}/trip</span>
                  <span>{vendor.completed_orders} completed</span>
                </div>
              </div>
            </div>

            {vendor.kyc_status === "pending" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={busyId === vendor.id}
                  onClick={() => onDecide(vendor.id, "approve")}
                >
                  <Check className="size-4" strokeWidth={3} />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busyId === vendor.id}
                  onClick={() => onDecide(vendor.id, "reject")}
                >
                  <Close className="size-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cx("px-4 py-3 font-semibold", className)}>{children}</th>;
}
