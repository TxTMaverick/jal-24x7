"use client";

import Image from "next/image";
import { useState } from "react";

import { discountPercent, money, speedLabel } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";
import { Check, Clock } from "./icons";
import { Badge, Button, QuantityStepper } from "./ui";

const FALLBACK_IMAGE = "/images/products/can-20l.jpg";

export function ProductCard({ product }: { product: Product }) {
  const { addProduct } = useCart();
  const { success } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const off = discountPercent(product.price, product.mrp);
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 10;

  const handleAdd = () => {
    addProduct(product, quantity);
    success(`${quantity} × ${product.name} added to your cart.`, "Added to cart");
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
    setQuantity(1);
  };

  return (
    <article className="card group flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-(--shadow-lift)">
      <div className="relative h-44 overflow-hidden bg-brand-50">
        <Image
          src={product.image_url || FALLBACK_IMAGE}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {off !== null && <Badge tone="warn">{off}% off</Badge>}
          {lowStock && <Badge tone="danger">Only {product.stock} left</Badge>}
          {outOfStock && <Badge tone="neutral">Out of stock</Badge>}
        </div>

        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-ink-700 shadow-sm backdrop-blur">
          <Clock className="size-3" />
          {product.eta_minutes} min
        </span>

        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-ink-900/45 to-transparent"
        />
        <span className="absolute bottom-2.5 left-3 text-xs font-semibold text-white drop-shadow">
          {product.capacity_l}L
          {product.pack_size > 1 ? ` × ${product.pack_size}` : ""}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-snug text-ink-900">{product.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-500">
          {product.description}
        </p>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <div className="flex gap-1">
            <dt className="text-ink-400">Total</dt>
            <dd className="font-semibold text-ink-700">
              {product.capacity_l * product.pack_size}L
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-ink-400">Delivery</dt>
            <dd className="font-semibold text-ink-700">{speedLabel(product.delivery_speed)}</dd>
          </div>
        </dl>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-lg font-bold text-ink-900">{money(product.price)}</p>
              {product.mrp && product.mrp > product.price && (
                <p className="text-xs text-ink-400 line-through">{money(product.mrp)}</p>
              )}
            </div>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.min(99, product.stock || 1)}
              size="sm"
            />
          </div>

          <Button
            fullWidth
            className="mt-3"
            onClick={handleAdd}
            disabled={outOfStock}
            variant={justAdded ? "secondary" : "primary"}
          >
            {justAdded ? (
              <>
                <Check className="size-4 text-success-600" strokeWidth={3} />
                Added
              </>
            ) : outOfStock ? (
              "Out of stock"
            ) : (
              "Add to Cart"
            )}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-44" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-11 w-full rounded-xl" />
      </div>
    </div>
  );
}
