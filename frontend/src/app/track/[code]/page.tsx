"use client";

/**
 * Screen 8. Live Order Tracking.
 *
 * Subscribes to `/api/orders/{code}/ws`. The FastAPI simulator advances the
 * order through the lifecycle and streams the courier's position, so the
 * stepper, ETA and map all move without a manual refresh. If the socket cannot
 * connect, we fall back to polling the REST snapshot so the screen still works.
 */

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";

import DynamicMap, { type MapMarker } from "@/components/DynamicMap";
import { Check, Clock, MapPin, Phone, Truck } from "@/components/icons";
import { Badge, Button, ErrorState, Rating } from "@/components/ui";
import { api, trackingSocketUrl } from "@/lib/api";
import { clockTime, cx, eta, money, statusLabel } from "@/lib/format";
import type { Order, Tracking } from "@/lib/types";

const STEP_LABELS: Record<string, { title: string; blurb: string }> = {
  pending: { title: "Order placed", blurb: "Awaiting payment confirmation" },
  confirmed: { title: "Confirmed", blurb: "Payment received, finding a supplier" },
  vendor_assigned: { title: "Vendor assigned", blurb: "Your supplier is preparing the order" },
  out_for_delivery: { title: "Out for delivery", blurb: "On the way to your address" },
  delivered: { title: "Delivered", blurb: "Water delivered, thank you!" },
};

export default function TrackPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const orderCode = code.toUpperCase();

  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);

  const loadSnapshot = useCallback(async () => {
    try {
      setTracking(await api.tracking(orderCode));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this order.");
    }
  }, [orderCode]);

  // Order details (items, totals) need auth; tracking itself is public.
  useEffect(() => {
    api
      .order(orderCode)
      .then(setOrder)
      .catch(() => setOrder(null));
  }, [orderCode]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  // Live socket, with polling fallback.
  useEffect(() => {
    let closedByUs = false;

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = window.setInterval(() => void loadSnapshot(), 4000);
    };
    const stopPolling = () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    let socket: WebSocket;
    try {
      socket = new WebSocket(trackingSocketUrl(orderCode));
    } catch {
      startPolling();
      return () => stopPolling();
    }
    socketRef.current = socket;

    socket.onopen = () => {
      setLive(true);
      stopPolling();
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as Tracking & { type?: string };
        setTracking(payload);
        setError(null);
        // Refresh the order card when the status changes (totals, vendor).
        if (payload.status === "delivered" || payload.status === "vendor_assigned") {
          api.order(orderCode).then(setOrder).catch(() => {});
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    socket.onclose = () => {
      setLive(false);
      if (!closedByUs) startPolling();
    };
    socket.onerror = () => {
      setLive(false);
      startPolling();
    };

    return () => {
      closedByUs = true;
      stopPolling();
      socket.close();
      socketRef.current = null;
    };
  }, [orderCode, loadSnapshot]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <ErrorState message={error} onRetry={() => void loadSnapshot()} />
        <div className="mt-4 text-center">
          <Link href="/orders">
            <Button variant="secondary">Back to My Orders</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="skeleton h-8 w-56 rounded" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="skeleton h-96 rounded-2xl" />
          <div className="skeleton h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  const cancelled = tracking.status === "cancelled";
  const delivered = tracking.status === "delivered";
  const currentIndex = tracking.status_index;

  const markers: MapMarker[] = [
    {
      id: "destination",
      lat: tracking.destination_lat,
      lng: tracking.destination_lng,
      kind: "customer",
      label: "Your address",
      sublabel: order?.address_line,
      active: true,
    },
  ];
  if (tracking.courier_lat != null && tracking.courier_lng != null && !delivered) {
    markers.push({
      id: "courier",
      lat: tracking.courier_lat,
      lng: tracking.courier_lng,
      kind: "courier",
      label: tracking.vendor_name ?? "Your delivery",
      sublabel: `ETA ${eta(tracking.eta_minutes)}`,
      active: true,
    });
  }

  const route: [number, number][] | undefined =
    tracking.courier_lat != null && tracking.courier_lng != null
      ? [
          [tracking.courier_lat, tracking.courier_lng],
          [tracking.destination_lat, tracking.destination_lng],
        ]
      : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Order {tracking.order_code}
            </p>
            {live && (
              <Badge tone="success">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
                </span>
                Live
              </Badge>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {cancelled ? "Order cancelled" : delivered ? "Delivered" : statusLabel(tracking.status)}
          </h1>
          {!cancelled && !delivered && (
            <p className="mt-1 text-sm text-ink-500">
              Estimated arrival in{" "}
              <span className="font-semibold text-ink-900">{eta(tracking.eta_minutes)}</span>
            </p>
          )}
        </div>

        <Link href="/orders">
          <Button variant="secondary" size="sm">
            All my orders
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* Map + ETA */}
        <div className="space-y-4">
          <div className="relative">
            <DynamicMap
              markers={markers}
              center={[tracking.destination_lat, tracking.destination_lng]}
              zoom={14}
              className="h-72 sm:h-96"
              follow={
                tracking.courier_lat != null && tracking.courier_lng != null && !delivered
                  ? [tracking.courier_lat, tracking.courier_lng]
                  : null
              }
              polyline={delivered ? undefined : route}
            />

            {!cancelled && (
              <div className="absolute bottom-3 left-3 right-3 z-[400] rounded-xl border border-ink-100 bg-white/95 p-3 shadow-(--shadow-lift) backdrop-blur">
                <div className="flex items-center gap-3">
                  <span
                    className={cx(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      delivered ? "bg-success-50 text-success-600" : "bg-accent-400/15 text-accent-600",
                    )}
                  >
                    {delivered ? <Check className="size-5" strokeWidth={3} /> : <Truck className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {delivered
                        ? "Delivered to your address"
                        : tracking.vendor_name
                          ? `${tracking.vendor_name} is on the way`
                          : "Assigning your supplier…"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {delivered ? "Order complete" : `ETA ${eta(tracking.eta_minutes)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-ink-400">Progress</p>
                    <p className="font-bold text-ink-900 tabular-nums">
                      {Math.round(tracking.progress * 100)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={cx(
                      "h-full rounded-full transition-all duration-700",
                      delivered ? "bg-success-500" : "bg-brand-500",
                    )}
                    style={{ width: `${Math.max(4, tracking.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Order contents */}
          {order && (
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900">Order details</h2>
              <ul className="mt-3 space-y-2 border-b border-ink-100 pb-3">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span className="text-ink-600">
                      <span className="font-medium text-ink-900">{item.quantity}×</span> {item.name}
                    </span>
                    <span className="font-semibold text-ink-900">{money(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-ink-500">
                  Paid via {order.payment_method.replace(/_/g, " ")}
                </span>
                <span className="text-lg font-bold text-ink-900">{money(order.total, true)}</span>
              </div>
              {order.payment_ref && (
                <p className="mt-1 font-mono text-[11px] text-ink-400">Ref {order.payment_ref}</p>
              )}
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-600">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-500" />
                <span>
                  {order.address_line}, {order.address_city} {order.address_pincode}
                  {order.delivery_slot && <> · {order.delivery_slot}</>}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Stepper + vendor */}
        <div className="space-y-4 lg:sticky lg:top-20">
          <div className="card p-5">
            <h2 className="font-semibold text-ink-900">Order progress</h2>

            <ol className="mt-4 space-y-0">
              {tracking.flow.map((step, index) => {
                const done = !cancelled && index < currentIndex;
                const active = !cancelled && index === currentIndex;
                const event = [...tracking.events].reverse().find((e) => e.status === step);
                const isLast = index === tracking.flow.length - 1;

                return (
                  <li key={step} className="relative flex gap-3.5 pb-6 last:pb-0">
                    {!isLast && (
                      <span
                        aria-hidden
                        className={cx(
                          "absolute left-[15px] top-8 h-full w-0.5 rounded",
                          done ? "bg-brand-500" : "bg-ink-100",
                        )}
                      />
                    )}

                    <span
                      className={cx(
                        "relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white transition-colors",
                        done && "bg-brand-500 text-white",
                        active && "bg-brand-600 text-white",
                        !done && !active && "bg-ink-100 text-ink-400",
                      )}
                    >
                      {done ? (
                        <Check className="size-4" strokeWidth={3} />
                      ) : active ? (
                        <span className="relative flex size-2.5">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                        </span>
                      ) : (
                        <span className="size-2 rounded-full bg-current" />
                      )}
                    </span>

                    <div className="min-w-0 flex-1 pt-1">
                      <p
                        className={cx(
                          "text-sm font-semibold",
                          done || active ? "text-ink-900" : "text-ink-400",
                        )}
                      >
                        {STEP_LABELS[step]?.title ?? statusLabel(step)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {event?.note || STEP_LABELS[step]?.blurb}
                      </p>
                      {event && (
                        <p className="mt-0.5 text-[11px] text-ink-400">
                          {clockTime(event.created_at)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {cancelled && (
              <div className="mt-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-600">
                This order was cancelled. Any reserved stock has been returned.
              </div>
            )}
          </div>

          {order?.vendor && (
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900">Your supplier</h2>
              <div className="mt-3 flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white">
                  <Truck className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900">{order.vendor.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">{order.vendor.tagline}</p>
                  <div className="mt-1.5">
                    <Rating value={order.vendor.rating} count={order.vendor.rating_count} />
                  </div>
                </div>
              </div>
              <a href={`tel:+91${order.vendor.phone}`} className="mt-3 block">
                <Button variant="secondary" size="sm" fullWidth>
                  <Phone className="size-4" />
                  Call supplier
                </Button>
              </a>
            </div>
          )}

          <div className="card flex items-start gap-2.5 bg-brand-50/60 p-4">
            <Clock className="mt-0.5 size-4 shrink-0 text-brand-600" />
            <p className="text-xs leading-relaxed text-ink-600">
              Updates arrive over a WebSocket from the FastAPI backend, no refresh needed. Delivery
              timings are compressed in this demo build so a full cycle completes in about a minute.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
