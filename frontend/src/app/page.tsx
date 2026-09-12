"use client";

/**
 * Landing page.
 *
 * Kept deliberately short: the intro animation, what JAL 24x7 is, the problem
 * and the answer to it in one glance, the four modules, and a quick order
 * form. Everything else lives behind the hamburger, so this page stays a
 * front door rather than a site map.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  Bottle,
  Building,
  Camper,
  Check,
  Clock,
  Jar,
  MapPin,
  Phone,
  Repeat,
  Shield,
  Truck,
  WaterDrop,
} from "@/components/icons";
import { SplashOverlay, useFirstVisitSplash } from "@/components/Splash";
import { Badge, Button, inputClass } from "@/components/ui";
import { api } from "@/lib/api";
import { cx, money } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";

const MODULES = [
  {
    href: "/products?category=can",
    image: "/images/products/can-20l.jpg",
    icon: Jar,
    title: "Cans & Bottles",
    blurb: "20L jars, sealed bottle packs and office supply.",
    price: "From ₹20",
  },
  {
    href: "/products?category=camper",
    image: "/images/products/camper-party.jpg",
    icon: Camper,
    title: "Party Campers",
    blurb: "Chilled 50L to 200L campers with taps and stands.",
    price: "From ₹150",
  },
  {
    href: "/tankers",
    image: "/images/products/tanker-yellow.jpg",
    icon: Truck,
    title: "Water Tankers",
    blurb: "1,000L to 12,000L trips for homes and societies.",
    price: "From ₹300",
  },
  {
    href: "/subscriptions",
    image: "/images/products/camper-office.jpg",
    icon: Repeat,
    title: "Subscriptions",
    blurb: "Daily, weekly or monthly delivery on autopilot.",
    price: "Up to 12% off",
  },
];

/** Three problems, each answered directly by the row beside it. */
const PAIRS = [
  {
    icon: Phone,
    problem: "You phone around four numbers and hope somebody picks up.",
    solution: "Every verified supplier near you, with rates, on one screen.",
  },
  {
    icon: Clock,
    problem: "Most suppliers shut by evening. A tank dry at 10 pm stays dry.",
    solution: "Book at any hour, with night-shift drivers listed separately.",
  },
  {
    icon: MapPin,
    problem: "Once the call ends you wait, with no idea when it arrives.",
    solution: "Live map tracking with the driver, vehicle number and ETA.",
  },
];

export default function HomePage() {
  const [splash, dismissSplash] = useFirstVisitSplash();

  return (
    <>
      <SplashOverlay visible={splash} onDone={dismissSplash} />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-linear-to-b from-white via-brand-50 to-brand-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-200/40 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-14 lg:pt-12 lg:px-8">
          <div className="animate-(--animate-fade-up)">
            <Badge tone="brand">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand-600" />
              </span>
              Delivering across Indore
            </Badge>

            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Clean water,
              <br />
              delivered <span className="text-brand-600">anytime</span>.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-600">
              Cans, bottles, campers and bulk tankers from verified local suppliers,
              booked in a few taps and tracked to your door.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="#order">
                <Button size="lg" className="px-7">
                  Order water now
                </Button>
              </Link>
              <Link href="/tankers">
                <Button size="lg" variant="secondary">
                  <Truck className="size-5" />
                  Book a tanker
                </Button>
              </Link>
            </div>
          </div>

          <DeliveryLoop />
        </div>
      </section>

      {/* ================= ABOUT ================= */}
      <section id="about" className="scroll-mt-20 bg-white py-10">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            About JAL 24×7
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            One place to buy water, at any hour
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink-600">
            JAL 24×7 puts every verified water supplier in your city on a single screen.
            A student ordering one jar and a housing society running a monthly tanker
            contract use the same platform, at published rates, with live tracking from
            the moment you pay.
          </p>

          <dl className="mx-auto mt-6 grid max-w-xl grid-cols-3 gap-4 border-t border-ink-100 pt-6">
            {[
              { value: "24×7", label: "Always open" },
              { value: "20L–12,000L", label: "One jar to a tanker" },
              { value: "100%", label: "KYC verified" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-xl font-bold text-brand-700 sm:text-2xl">{item.value}</dt>
                <dd className="mt-0.5 text-xs leading-snug text-ink-500">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ================= PROBLEM -> SOLUTION ================= */}
      <section className="bg-ink-900 py-10 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Buying water still works like it did twenty years ago
            </h2>
            <p className="mt-2.5 text-sm text-ink-300">
              Three things make it painful. Each one has a direct answer here.
            </p>
          </div>

          <ul className="mt-6 space-y-3">
            {PAIRS.map((pair) => (
              <li
                key={pair.problem}
                className="grid items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 sm:grid-cols-[auto_1fr_auto_1fr] sm:gap-5 sm:p-5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-500/20 text-accent-400">
                  <pair.icon className="size-5" />
                </span>
                <p className="text-sm leading-relaxed text-ink-300">{pair.problem}</p>
                <span aria-hidden className="hidden text-lg text-brand-400 sm:block">
                  →
                </span>
                <p className="flex items-start gap-2 text-sm font-medium leading-relaxed text-white">
                  <Check className="mt-0.5 size-4 shrink-0 text-success-500" strokeWidth={3} />
                  {pair.solution}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= MODULES ================= */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Modules</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Four ways to get water
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="card group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-(--shadow-lift)"
            >
              <div className="relative h-36 overflow-hidden bg-brand-50">
                <Image
                  src={module.image}
                  alt={module.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-ink-900/60 to-transparent" />
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-brand-700 backdrop-blur">
                  <module.icon className="size-3.5" />
                  {module.price}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-ink-900">{module.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{module.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= QUICK ORDER ================= */}
      <QuickOrder />
    </>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * The hero's animated order card.
 *
 * Steps itself through booked -> on the way -> delivered on a loop, so the
 * landing page shows what the product actually does instead of a static
 * screenshot. Purely decorative: it is hidden from assistive tech, which gets
 * the headline and the buttons instead.
 */
function DeliveryLoop() {
  const STEPS = [
    { label: "Booked", detail: "20L can × 2 · Vijay Nagar · ₹60", icon: Check },
    { label: "Driver assigned", detail: "Ramesh Yadav · MP09 KA 4412", icon: Truck },
    { label: "On the way", detail: "1.2 km away · driver en route", icon: MapPin },
    { label: "Delivered", detail: "Handed over at your door", icon: WaterDrop },
  ];

  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1900);
    return () => window.clearInterval(timer);
    // STEPS is a stable literal; the loop only depends on its length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const delivered = step === STEPS.length - 1;

  return (
    <div aria-hidden className="animate-(--animate-fade-up) [animation-delay:120ms]">
      <div className="card overflow-hidden shadow-(--shadow-lift)">
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-sm font-semibold text-ink-900">Your order</p>
          <Badge tone={delivered ? "success" : "brand"}>
            {delivered ? "Delivered" : "Live"}
          </Badge>
        </div>

        {/* The vehicle, running along a moving road. */}
        <div className="relative mx-5 mt-4 h-24 overflow-hidden rounded-xl bg-brand-50">
          <span
            className={cx(
              "absolute left-1/2 top-5 -translate-x-1/2 text-brand-600",
              !delivered && "animate-(--animate-float)",
            )}
          >
            {delivered ? <Jar className="size-12" /> : <Truck className="size-12" />}
          </span>

          {/* Water climbing inside the can once it lands. */}
          {delivered && (
            <span className="absolute inset-x-0 bottom-8 mx-auto h-6 w-9 overflow-hidden rounded-b-md">
              <span className="block size-full bg-brand-400/50 animate-(--animate-fill)" />
            </span>
          )}

          <span
            className={cx(
              "absolute inset-x-0 bottom-5 h-0.5",
              !delivered && "animate-(--animate-road)",
            )}
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg,#91d7ff 0 10px,transparent 10px 18px)",
            }}
          />
        </div>

        {/* Step list, current one highlighted. */}
        <ol className="mt-4 space-y-1.5 px-5">
          {STEPS.map((item, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={item.label}
                className={cx(
                  "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-500",
                  current ? "bg-brand-50" : "opacity-55",
                )}
              >
                <span
                  className={cx(
                    "grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-500",
                    current
                      ? "bg-brand-600 text-white"
                      : done
                        ? "bg-success-500 text-white"
                        : "bg-ink-100 text-ink-400",
                  )}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <item.icon className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      "block text-xs font-semibold",
                      current ? "text-brand-700" : "text-ink-700",
                    )}
                  >
                    {item.label}
                  </span>
                  {current && (
                    <span className="block truncate text-[11px] text-ink-500">{item.detail}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        {/*
          The delivery promise, as a footer row inside the card.
          It used to float over the bottom-left corner, where it covered the
          last step of the very list it was sitting on.
        */}
        <div className="mt-4 flex items-center gap-3 border-t border-ink-100 bg-ink-50/60 px-5 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success-50 text-success-600">
            <Clock className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-400">Delivered to your door</p>
            <p className="text-sm font-bold text-ink-900">20L can, delivery included</p>
          </div>
          <span className="shrink-0 text-right">
            <span className="block text-[11px] text-ink-400">From</span>
            <span className="block text-sm font-bold text-brand-700">₹30</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Simple in-page order form that drops straight into the cart. */
function QuickOrder() {
  const { addProduct } = useCart();
  const { success, error: toastError } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [choice, setChoice] = useState<"can" | "bottle" | "camper">("can");
  const [productId, setProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(2);
  const [pincode, setPincode] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api
      .products({ sort: "price_asc" })
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const options = useMemo(
    () => products.filter((p) => p.category === choice),
    [products, choice],
  );

  useEffect(() => {
    setProductId(options[0]?.id ?? null);
  }, [options]);

  const selected = options.find((p) => p.id === productId) ?? null;

  const checkPincode = async () => {
    if (pincode.length !== 6) return;
    setChecking(true);
    try {
      const info = await api.pincode(pincode);
      if (info.available) {
        setArea(`${info.district}, ${info.state}`);
        success(`We deliver in ${info.district}. Add items and check out.`, "Serviceable");
      } else {
        setArea(null);
        toastError(info.detail ?? "We could not verify that PIN code.");
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "PIN code lookup is unavailable right now.");
    } finally {
      setChecking(false);
    }
  };

  const addToCart = () => {
    if (!selected) return;
    addProduct(selected, quantity);
    success(`${quantity} × ${selected.name} added to your cart.`, "Added to cart");
  };

  return (
    <section id="order" className="scroll-mt-20 bg-white py-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            Quick order
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            Book water in three fields
          </h2>
        </div>

        <div className="card overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
            <div className="p-6 sm:p-8">
              {/* 1. What */}
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                1. What do you need?
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(
                  [
                    ["can", "20L Can", Jar],
                    ["bottle", "Bottles", Bottle],
                    ["camper", "Camper", Camper],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChoice(key)}
                    aria-pressed={choice === key}
                    className={cx(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                      choice === key
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-ink-200 hover:border-brand-300",
                    )}
                  >
                    <Icon className={cx("size-5", choice === key ? "text-brand-600" : "text-ink-400")} />
                    <span className="text-xs font-semibold text-ink-900">{label}</span>
                  </button>
                ))}
              </div>

              {/* 2. Which + how many */}
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">
                2. Which one, and how many?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={productId ?? ""}
                  onChange={(e) => setProductId(Number(e.target.value))}
                  className={inputClass}
                  aria-label="Choose a product"
                >
                  {options.length === 0 && <option>Loading…</option>}
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {money(p.price)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 rounded-xl bg-ink-50 px-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="grid size-8 place-items-center rounded-lg text-brand-700 hover:bg-white"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center text-sm font-bold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                    className="grid size-8 place-items-center rounded-lg text-brand-700 hover:bg-white"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 3. Where */}
              <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-400">
                3. Where should it go?
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setArea(null);
                  }}
                  inputMode="numeric"
                  placeholder="Enter your 6-digit PIN code"
                  aria-label="PIN code"
                  className={inputClass}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={checkPincode}
                  loading={checking}
                  disabled={pincode.length !== 6}
                >
                  Check
                </Button>
              </div>
              {area && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success-600">
                  <Check className="size-3.5" strokeWidth={3} />
                  We deliver in {area}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" onClick={addToCart} disabled={!selected}>
                  Add to cart
                </Button>
                <Link href="/cart">
                  <Button size="lg" variant="secondary">
                    Go to cart →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Preview panel */}
            <div className="relative min-h-56 bg-brand-50 lg:min-h-0">
              {selected && (
                <>
                  <Image
                    src={selected.image_url || "/images/products/can-20l.jpg"}
                    alt={selected.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-ink-900/85 via-ink-900/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-sm font-semibold">{selected.name}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-white/70">Total for {quantity}</p>
                        <p className="text-2xl font-bold">{money(selected.price * quantity)}</p>
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Other ways to book */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { href: "/tankers", icon: Truck, label: "Book a tanker", detail: "Bulk, per trip" },
            { href: "/suppliers", icon: Building, label: "Find suppliers", detail: "Compare rates near you" },
            { href: "/subscriptions", icon: Repeat, label: "Subscribe", detail: "Monthly and recurring" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-(--shadow-lift)"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{item.label}</span>
                <span className="block text-xs text-ink-500">{item.detail}</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-400">
          <Shield className="size-3.5 text-success-500" />
          Every supplier clears a KYC check before they are listed.
        </p>
      </div>
    </section>
  );
}
