"use client";

/** Screen 9. My Orders / Order History. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Cart as CartIcon, Clock, MapPin, Repeat, Truck } from "@/components/icons";
import { Badge, Button, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { cx, dateTime, eta, litres, money, statusLabel, statusTone } from "@/lib/format";
import type { Order } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useToast } from "@/store/toast";

const FILTERS = [
  { key: "", label: "All orders" },
  { key: "active", label: "Active" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, error: toastError } = useToast();

  const [filter, setFilter] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setOrders(await api.myOrders(filter || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders.");
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  useEffect(() => {
    if (!authLoading && user) void load();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, load]);

  const handleReorder = async (code: string) => {
    setBusyCode(code);
    try {
      const created = await api.reorder(code);
      await api.payOrder(created.order_code);
      success(`Reordered as ${created.order_code}. Tracking is live.`, "Order placed");
      router.push(`/track/${created.order_code}`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not repeat that order.");
      setBusyCode(null);
    }
  };

  const handleCancel = async (code: string) => {
    setBusyCode(code);
    try {
      await api.cancelOrder(code);
      success(`Order ${code} cancelled.`);
      void load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Could not cancel that order.");
    } finally {
      setBusyCode(null);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-9 sm:px-6">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={<CartIcon className="size-6" />}
          title="Sign in to see your orders"
          description="Your order history, live tracking and one-tap reorder all live behind a quick OTP login."
          action={
            <Link href="/login?next=/orders">
              <Button>Sign in with OTP</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Account"
        title="My Orders"
        subtitle="Everything you have booked, track what is live, and repeat a past order in one tap."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={cx(
              "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              filter === option.key
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-6" />}
          title={filter ? "No orders in this view" : "No orders yet"}
          description={
            filter
              ? "Try a different filter to see the rest of your history."
              : "Once you book water, your orders will appear here with live tracking."
          }
          action={
            <Link href="/products">
              <Button>Order water now</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const isActive = !["delivered", "cancelled"].includes(order.status);
            const canCancel = !["out_for_delivery", "delivered", "cancelled"].includes(order.status);
            const totalLitres = order.items.reduce(
              (sum, item) => sum + item.capacity_l * item.quantity,
              0,
            );

            return (
              <li key={order.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
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
                      {order.order_type === "tanker" && <Badge tone="brand">Tanker</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-400">
                      Placed {dateTime(order.created_at)}
                      {order.vendor && <> · {order.vendor.name}</>}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-bold text-ink-900">{money(order.total, true)}</p>
                    <p className="text-xs text-ink-400">
                      {order.payment_status === "paid" ? "Paid" : "Payment pending"}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  {order.items.map((item) => (
                    <li key={item.id} className="text-sm text-ink-600">
                      <span className="font-medium text-ink-900">{item.quantity}×</span> {item.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    <span className="max-w-56 truncate">{order.address_line}</span>
                  </span>
                  {isActive && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      ETA {eta(order.eta_minutes)}
                    </span>
                  )}
                  <span>{litres(totalLitres)}</span>
                  {order.delivery_slot && <span>{order.delivery_slot}</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/track/${order.order_code}`}>
                    <Button size="sm" variant={isActive ? "primary" : "secondary"}>
                      {isActive ? "Track live" : "View details"}
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busyCode === order.order_code}
                    onClick={() => void handleReorder(order.order_code)}
                  >
                    <Repeat className="size-4" />
                    Reorder
                  </Button>

                  {canCancel && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={busyCode === order.order_code}
                      onClick={() => void handleCancel(order.order_code)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
