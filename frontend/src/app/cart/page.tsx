"use client";

/** Screen 6 (part 1). Cart: line items, quantity edit, live server-priced totals. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Cart as CartIcon, Check, Trash, Truck } from "@/components/icons";
import { Badge, Button, EmptyState, QuantityStepper } from "@/components/ui";
import { api } from "@/lib/api";
import { litres, money } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { useCart } from "@/store/cart";

export default function CartPage() {
  const { items, hydrated, hasTanker, setQuantity, remove, clear, toLines, count } = useCart();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Re-price on the server whenever the cart changes. never trust local maths.
  const refreshQuote = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    setQuoting(true);
    setQuoteError(null);
    try {
      setQuote(await api.quote({ lines: toLines(), is_society: false }));
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : "Could not price this cart.");
    } finally {
      setQuoting(false);
    }
  }, [items, toLines]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshQuote();
  }, [hydrated, refreshQuote]);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="skeleton h-8 w-40 rounded" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={<CartIcon className="size-6" />}
          title="Your cart is empty"
          description="Add 20L cans, bottle packs or a party camper, or book a bulk tanker trip."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/products">
                <Button>Browse products</Button>
              </Link>
              <Link href="/tankers">
                <Button variant="secondary">
                  <Truck className="size-4" />
                  Book a tanker
                </Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Your Cart</h1>
          <p className="mt-1 text-sm text-ink-500">
            {count} item{count === 1 ? "" : "s"}
            {quote && <> · {litres(quote.total_litres)} of water</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={clear}>
          <Trash className="size-4" />
          Clear cart
        </Button>
      </div>

      {hasTanker && (
        <div className="card mb-5 flex items-start gap-3 bg-brand-50/70 p-4">
          <Badge tone="brand">Tanker order</Badge>
          <p className="text-xs leading-relaxed text-ink-600">
            This is a bulk tanker booking, billed per trip. A distance surcharge applies beyond 8 km
            and is calculated at checkout once you drop your delivery pin.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        {/* Line items */}
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.key} className="card flex gap-4 p-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-brand-50 text-3xl">
                {item.image}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-snug text-ink-900">{item.name}</h3>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {item.meta ? `${item.meta} · ` : ""}
                      {litres(item.capacityL)} each
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.key)}
                    aria-label={`Remove ${item.name}`}
                    className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <QuantityStepper
                    value={item.quantity}
                    onChange={(next) => setQuantity(item.key, next)}
                  />
                  <div className="text-right">
                    <p className="font-bold text-ink-900">
                      {money(item.unitPrice * item.quantity)}
                    </p>
                    <p className="text-xs text-ink-400">{money(item.unitPrice)} each</p>
                  </div>
                </div>
              </div>
            </li>
          ))}

          <li>
            <Link href={hasTanker ? "/tankers" : "/products"}>
              <Button variant="ghost" size="sm">
                ← Continue shopping
              </Button>
            </Link>
          </li>
        </ul>

        {/* Order summary */}
        <aside className="card sticky top-20 p-5">
          <h2 className="font-semibold text-ink-900">Order summary</h2>

          {quoteError ? (
            <div className="mt-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-600">
              {quoteError}
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => void refreshQuote()}>
                Retry
              </Button>
            </div>
          ) : quote ? (
            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Subtotal" value={money(quote.subtotal, true)} />
              {quote.discount > 0 && (
                <div className="flex justify-between text-success-600">
                  <dt>{quote.discount_label || "Discount"}</dt>
                  <dd className="font-semibold">−{money(quote.discount, true)}</dd>
                </div>
              )}
              <Row
                label="Delivery"
                value={quote.delivery_fee === 0 ? "FREE" : money(quote.delivery_fee, true)}
                tone={quote.delivery_fee === 0 ? "success" : undefined}
              />
              <Row label="GST (18%)" value={money(quote.tax, true)} />

              <div className="flex items-end justify-between border-t border-ink-100 pt-3">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="text-2xl font-bold text-ink-900">{money(quote.total, true)}</dd>
              </div>

              {quote.delivery_fee > 0 && (
                <p className="rounded-lg bg-brand-50 p-2.5 text-xs text-brand-700">
                  Add {money(500 - quote.subtotal)} more to unlock free delivery.
                </p>
              )}
              {quote.discount > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-success-600">
                  <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />
                  {quote.discount_label} applied automatically.
                </p>
              )}
            </dl>
          ) : (
            <div className="mt-4 space-y-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-8 w-full rounded" />
            </div>
          )}

          <Link href="/checkout" className="mt-5 block">
            <Button fullWidth size="lg" loading={quoting} disabled={!quote}>
              Proceed to checkout
            </Button>
          </Link>

          <p className="mt-3 text-center text-[11px] text-ink-400">
            Prices are calculated on the server. You will confirm your address and slot next.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="flex justify-between text-ink-600">
      <dt>{label}</dt>
      <dd className={tone === "success" ? "font-semibold text-success-600" : "font-semibold text-ink-900"}>
        {value}
      </dd>
    </div>
  );
}
