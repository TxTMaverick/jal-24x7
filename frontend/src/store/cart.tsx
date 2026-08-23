"use client";

/**
 * Cart context, persisted to localStorage so a refresh does not lose the cart.
 *
 * The cart stores ids + quantities only. Prices shown at checkout always come
 * back from the server's /api/quote, so the number on screen is the number the
 * server will charge.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CartLineIn, Product, TankerTier } from "@/lib/types";

export interface CartItem {
  key: string;
  item_type: "product" | "tanker";
  refId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  capacityL: number;
  image: string;
  meta?: string;
}

const STORAGE_KEY = "jal24x7_cart";

interface CartValue {
  items: CartItem[];
  count: number;
  estimatedSubtotal: number;
  hasTanker: boolean;
  hydrated: boolean;
  addProduct: (product: Product, quantity?: number) => void;
  addTanker: (tier: TankerTier, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  toLines: () => CartLineIn[];
}

const CartContext = createContext<CartValue | null>(null);

function readStored(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // `hydrated` prevents a server/client markup mismatch: the first render must
  // match the server (empty cart), and only then do we load from localStorage.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* quota exceeded / private mode, the cart just won't persist */
    }
  }, [items, hydrated]);

  const upsert = useCallback((next: CartItem) => {
    setItems((current) => {
      const existing = current.find((i) => i.key === next.key);
      if (existing) {
        return current.map((i) =>
          i.key === next.key
            ? { ...i, quantity: Math.min(99, i.quantity + next.quantity) }
            : i,
        );
      }
      return [...current, next];
    });
  }, []);

  const addProduct = useCallback(
    (product: Product, quantity = 1) => {
      upsert({
        key: `product-${product.id}`,
        item_type: "product",
        refId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity,
        capacityL: product.capacity_l * product.pack_size,
        image: product.image,
        meta: product.pack_size > 1 ? `Pack of ${product.pack_size}` : undefined,
      });
    },
    [upsert],
  );

  const addTanker = useCallback(
    (tier: TankerTier, quantity = 1) => {
      upsert({
        key: `tanker-${tier.id}`,
        item_type: "tanker",
        refId: tier.id,
        name: `${tier.capacity_l}L Water Tanker`,
        unitPrice: tier.base_price,
        quantity,
        capacityL: tier.capacity_l,
        image: "\u{1F69B}",
        meta: `${tier.segment === "society" ? "Society" : "Individual"} · per trip`,
      });
    },
    [upsert],
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((i) => i.key !== key)
        : current.map((i) => (i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i)),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const toLines = useCallback(
    (): CartLineIn[] =>
      items.map((i) => ({
        item_type: i.item_type,
        product_id: i.item_type === "product" ? i.refId : null,
        tanker_tier_id: i.item_type === "tanker" ? i.refId : null,
        quantity: i.quantity,
      })),
    [items],
  );

  const value = useMemo<CartValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const estimatedSubtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return {
      items,
      count,
      estimatedSubtotal,
      hasTanker: items.some((i) => i.item_type === "tanker"),
      hydrated,
      addProduct,
      addTanker,
      setQuantity,
      remove,
      clear,
      toLines,
    };
  }, [items, hydrated, addProduct, addTanker, setQuantity, remove, clear, toLines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
