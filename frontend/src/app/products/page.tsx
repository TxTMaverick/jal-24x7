"use client";

/** Screen 2. All Products: one page, tabbed by category, filterable and sortable. */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { Bottle, Camper, Jar, Search, WaterDrop } from "@/components/icons";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Badge, Button, EmptyState, ErrorState, PageHeader, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const TABS: { key: Category | "all"; label: string; icon: typeof Jar }[] = [
  { key: "all", label: "Everything", icon: WaterDrop },
  { key: "can", label: "20L Cans", icon: Jar },
  { key: "bottle", label: "Bottles", icon: Bottle },
  { key: "camper", label: "Campers", icon: Camper },
];

const SORTS = [
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "capacity_desc", label: "Capacity: high to low" },
  { key: "capacity_asc", label: "Capacity: low to high" },
  { key: "fastest", label: "Fastest delivery" },
] as const;

const SPEEDS = [
  { key: "", label: "Any speed" },
  { key: "instant", label: "Under 1 hr" },
  { key: "same_day", label: "Same day" },
  { key: "scheduled", label: "Scheduled" },
];

const PRICE_BANDS = [
  { key: "", label: "Any price", min: undefined, max: undefined },
  { key: "under-200", label: "Under ₹200", min: undefined, max: 200 },
  { key: "200-500", label: "₹200 - ₹500", min: 200, max: 500 },
  { key: "500-plus", label: "Above ₹500", min: 500, max: undefined },
];

function ProductsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCategory = (searchParams.get("category") as Category | null) ?? "all";

  const [category, setCategory] = useState<Category | "all">(initialCategory);
  const [sort, setSort] = useState<string>("price_asc");
  const [speed, setSpeed] = useState("");
  const [band, setBand] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box so we do not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Keep the category in the URL so the tab survives a refresh / share.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    const query = params.toString();
    router.replace(query ? `/products?${query}` : "/products", { scroll: false });
  }, [category, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const priceBand = PRICE_BANDS.find((b) => b.key === band);
    try {
      const data = await api.products({
        category: category === "all" ? undefined : category,
        sort,
        delivery_speed: speed || undefined,
        min_price: priceBand?.min,
        max_price: priceBand?.max,
        search: debouncedSearch || undefined,
      });
      setProducts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [category, sort, speed, band, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilters = useMemo(
    () => [speed, band, debouncedSearch].filter(Boolean).length,
    [speed, band, debouncedSearch],
  );

  const clearFilters = () => {
    setSpeed("");
    setBand("");
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Shop"
        title="All Products"
        subtitle="Bottles, 20L cans and campers, everything a home, office or event needs, delivered from verified suppliers near you."
      />

      {/* Category tabs */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const active = category === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setCategory(tab.key)}
              aria-pressed={active}
              className={cx(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-50",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter / sort bar */}
      <div className="card mb-6 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cans, bottles, campers…"
            className={cx(inputClass, "pl-9")}
            aria-label="Search products"
          />
        </div>

        <select
          value={band}
          onChange={(e) => setBand(e.target.value)}
          className={cx(inputClass, "w-auto min-w-36")}
          aria-label="Filter by price"
        >
          {PRICE_BANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>

        <select
          value={speed}
          onChange={(e) => setSpeed(e.target.value)}
          className={cx(inputClass, "w-auto min-w-36")}
          aria-label="Filter by delivery speed"
        >
          {SPEEDS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className={cx(inputClass, "w-auto min-w-44")}
          aria-label="Sort products"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      {/* Results */}
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Search className="size-6" />}
          title="Nothing matches those filters"
          description="Try widening the price range or clearing the search."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-ink-500">
            Showing <span className="font-semibold text-ink-900">{products.length}</span>{" "}
            product{products.length === 1 ? "" : "s"}
            {category !== "all" && (
              <>
                {" "}
                in <Badge tone="brand">{TABS.find((t) => t.key === category)?.label}</Badge>
              </>
            )}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      <div className="card mt-10 flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-brand-50 to-white p-6">
        <div>
          <h3 className="font-semibold text-ink-900">Need more than a few cans?</h3>
          <p className="mt-1 text-sm text-ink-500">
            Bulk tankers from 1000L to 12,000L are billed per trip and booked separately.
          </p>
        </div>
        <a href="/tankers">
          <Button variant="secondary">Browse water tankers</Button>
        </a>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="skeleton h-10 w-56 rounded" />
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
