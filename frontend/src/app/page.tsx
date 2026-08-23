"use client";

/**
 * Screen 1. Landing page.
 *
 * One scrollable page with its own sticky section navigation:
 *   Hero -> Problem -> Solution -> Quick order -> Why us -> FAQ -> Wordmark
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BigWordmark, FaqAccordion, MadeInIndia, SectionNav, type FaqItem } from "@/components/Brand";
import {
  Bottle,
  Building,
  Calendar,
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
import type { Product, WeatherInfo } from "@/lib/types";
import { useCart } from "@/store/cart";
import { useToast } from "@/store/toast";

const SECTIONS = [
  { id: "top", label: "Home" },
  { id: "problem", label: "The Problem" },
  { id: "solution", label: "Our Solution" },
  { id: "order", label: "Quick Order" },
  { id: "why", label: "Why JAL 24×7" },
  { id: "faq", label: "FAQ" },
];

const INDORE: [number, number] = [22.7196, 75.8577];

const SERVICES = [
  {
    href: "/products?category=can",
    image: "/images/products/can-20l.jpg",
    icon: Jar,
    title: "20L Water Cans",
    blurb: "The everyday jar for homes, offices and hostels. Empty can exchanged on delivery.",
    price: "From ₹60",
  },
  {
    href: "/products?category=bottle",
    image: "/images/products/bottle-500ml.jpg",
    icon: Bottle,
    title: "Bottles & Packs",
    blurb: "Sealed 500ml, 1L and 2L packs for meetings, travel and functions.",
    price: "From ₹216",
  },
  {
    href: "/products?category=camper",
    image: "/images/products/camper-party.jpg",
    icon: Camper,
    title: "Party Campers",
    blurb: "Chilled 50L to 200L campers with taps and stands for events.",
    price: "From ₹320",
  },
  {
    href: "/tankers",
    image: "/images/products/tanker-yellow.jpg",
    icon: Truck,
    title: "Water Tankers",
    blurb: "1,000L to 12,000L bulk trips for homes, societies and sites.",
    price: "From ₹450",
  },
];

const PROBLEMS = [
  {
    icon: Phone,
    title: "You have to phone around",
    body: "Finding water means calling four or five numbers passed on by neighbours, hoping somebody picks up.",
  },
  {
    icon: Clock,
    title: "Nobody works late",
    body: "Most suppliers shut by evening. A tank that runs dry at 10 pm stays dry until morning.",
  },
  {
    icon: Shield,
    title: "No idea what you are paying for",
    body: "Prices change with the caller. There is no way to compare rates, capacity or water quality first.",
  },
  {
    icon: MapPin,
    title: "No idea when it arrives",
    body: "Once the call ends you wait. No confirmation, no vehicle number, no arrival time.",
  },
];

const SOLUTIONS = [
  {
    icon: WaterDrop,
    title: "Everything in one place",
    body: "Cans, bottles, campers and tankers from every verified supplier near you, on a single screen.",
  },
  {
    icon: Clock,
    title: "Open around the clock",
    body: "Book at any hour. Night shift drivers are listed separately so urgent orders reach someone awake.",
  },
  {
    icon: Shield,
    title: "Prices you can compare",
    body: "Every rate, capacity, rating and water source is published up front. No negotiating on the phone.",
  },
  {
    icon: MapPin,
    title: "Watch it come to you",
    body: "Live map tracking from the moment you pay, with the driver's name, vehicle number and arrival time.",
  },
];

const WHY_US = [
  {
    icon: Shield,
    title: "Only verified suppliers",
    body: "Every operator clears a KYC check before they can be listed. Unverified applicants never appear in search.",
    stat: "100% KYC checked",
  },
  {
    icon: Truck,
    title: "You see the driver",
    body: "Name, vehicle number, licence, languages spoken and which operator they work under. Before they arrive.",
    stat: "14 drivers on roster",
  },
  {
    icon: MapPin,
    title: "Genuinely live tracking",
    body: "A real WebSocket feed, not a page that refreshes. The map moves as the vehicle moves.",
    stat: "Updates every 2s",
  },
  {
    icon: Building,
    title: "One can to twelve thousand litres",
    body: "The same platform serves a student ordering one jar and an RWA running a monthly tanker contract.",
    stat: "20L to 12,000L",
  },
  {
    icon: Repeat,
    title: "Subscriptions that save money",
    body: "Set a daily or weekly delivery once and stop reordering. Recurring plans cost up to 12 percent less.",
    stat: "Up to 12% off",
  },
  {
    icon: Phone,
    title: "Government helplines built in",
    body: "Zone-wise Jal Sansthan numbers for tanker requests, complaints and billing, detected from your location.",
    stat: "8 zones covered",
  },
];

const FAQS: FaqItem[] = [
  {
    question: "How quickly can I get water delivered?",
    answer:
      "A 20 litre can typically reaches you in 35 to 45 minutes inside Indore city limits. Bottle packs follow the same window. Campers are same day or scheduled, and tankers are scheduled because a trip has to be planned around the operator's route. The exact estimate for your pin is shown before you pay.",
  },
  {
    question: "How is the delivery charge calculated?",
    answer:
      "Orders above ₹500 ship free. Below that a flat ₹40 applies, or ₹80 if you choose express dispatch. Tankers work differently: the trip rate already covers delivery within 8 km, and beyond that a distance surcharge of ₹12 per kilometre is added as its own visible line. GST at 18 percent applies on the total.",
  },
  {
    question: "Do I need to return the empty can?",
    answer:
      "Yes. The 20 litre jar is exchanged, so hand the empty one to the delivery partner when the full can arrives. If it is your first order you can request a new jar and a one-time refundable deposit is collected instead.",
  },
  {
    question: "Can I book a tanker for a society or an apartment block?",
    answer:
      "Society bookings have their own module with contract pricing, roughly 8 percent below the individual spot rate. You can book a single trip or set up a recurring schedule with your preferred delivery window, number of flats and tank capacity.",
  },
  {
    question: "How do you check water quality?",
    answer:
      "Every supplier declares their water source, purification stages and certifications during KYC, and those are shown on their profile. JAL 24×7 does not operate its own testing laboratory, so we publish what suppliers declare rather than claiming to verify it ourselves. For a formal potability report, the government zone office in our directory is the right contact.",
  },
  {
    question: "Which payment methods can I use?",
    answer:
      "UPI apps such as Google Pay, PhonePe and Paytm, any UPI ID, credit and debit cards, net banking with eight major banks, or cash on delivery. This build runs in test mode, so no money actually moves and no card details are stored.",
  },
  {
    question: "Can I cancel an order after paying?",
    answer:
      "You can cancel any time before the vehicle leaves the depot, and reserved stock goes straight back. Once the status reaches out for delivery the trip is already under way and cancellation is no longer possible from the app.",
  },
  {
    question: "How much water should I order for a function?",
    answer:
      "The usual planning figure is about 1.5 litres per guest for a four hour function, increased by roughly a quarter in summer. The event booking page has a calculator that works this out and puts you in touch with suppliers near the venue who staff an event desk.",
  },
];

export default function HomePage() {
  const [splash, dismissSplash] = useFirstVisitSplash();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    api
      .products({ sort: "price_asc" })
      .then((all) => {
        const picks: Product[] = [];
        for (const category of ["can", "bottle", "camper"]) {
          const match = all.find((p) => p.category === category);
          if (match) picks.push(match);
        }
        setFeatured(picks);
      })
      .catch(() => setFeatured([]));

    api
      .weather(INDORE[0], INDORE[1])
      .then(setWeather)
      .catch(() => setWeather(null));
  }, []);

  return (
    <>
      <SplashOverlay visible={splash} onDone={dismissSplash} />

      {/* ================= HERO ================= */}
      <section id="top" className="relative overflow-hidden bg-linear-to-b from-white via-brand-50 to-brand-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-cyan-200/35 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-20 lg:pt-16 lg:px-8">
          <div className="animate-(--animate-fade-up)">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand-600" />
                </span>
                Delivering across Indore
              </Badge>
              <MadeInIndia />
            </div>

            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
              Clean water,
              <br />
              delivered{" "}
              <span className="relative whitespace-nowrap text-brand-600">
                anytime
                <svg
                  aria-hidden
                  viewBox="0 0 200 12"
                  className="absolute -bottom-1 left-0 w-full text-brand-300"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 8c40-6 90-6 130-3s50 4 66 1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
              Bottles, 20 litre cans, party campers and bulk tankers, booked in a few taps from
              verified local suppliers, with live tracking from confirmation to your door.
            </p>

            {/* Live weather driven demand hint, from the Open-Meteo API */}
            {weather?.available && (
              <div
                className={cx(
                  "mt-6 flex items-start gap-3 rounded-xl p-3.5 ring-1",
                  weather.demand_level === "normal"
                    ? "bg-white ring-ink-200"
                    : "bg-accent-400/10 ring-accent-500/25",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-sm">
                  {weather.demand_level === "normal" ? "🌤️" : "🌡️"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900">
                    {weather.temperature_c !== null && `${Math.round(weather.temperature_c)}°C in Indore`}
                    {weather.condition && ` · ${weather.condition}`}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{weather.advice}</p>
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
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

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-200/70 pt-6">
              {[
                { value: "24×7", label: "Always open" },
                { value: "4-in-1", label: "Can, bottle, camper, tanker" },
                { value: "100%", label: "Verified suppliers" },
              ].map((item) => (
                <div key={item.value}>
                  <dt className="text-2xl font-bold text-brand-700">{item.value}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-ink-500">{item.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroCard featured={featured} />
        </div>
      </section>

      <SectionNav sections={SECTIONS} />

      {/* ================= SERVICE TILES ================= */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What we deliver"
          title="Four services, one platform"
          subtitle="From a single jar for a hostel room to a twelve thousand litre tanker for a housing society."
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              className="card group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-(--shadow-lift)"
            >
              <div className="relative h-40 overflow-hidden bg-brand-50">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-ink-900/60 to-transparent" />
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-brand-700 backdrop-blur">
                  <service.icon className="size-3.5" />
                  {service.price}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-ink-900">{service.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{service.blurb}</p>
                <span className="mt-3 inline-block text-sm font-semibold text-brand-600 transition-transform group-hover:translate-x-0.5">
                  Browse →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= PROBLEM ================= */}
      <section id="problem" className="scroll-mt-32 bg-ink-900 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-400">
              The problem
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Getting water should not be this hard
            </h2>
            <p className="mt-3 text-ink-200">
              In most Indian towns, buying drinking water still works the way it did twenty years
              ago. Here is what that actually looks like.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROBLEMS.map((problem, index) => (
              <div
                key={problem.title}
                className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition-colors hover:bg-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent-500/20 text-accent-400">
                    <problem.icon className="size-5" />
                  </span>
                  <span className="text-3xl font-black text-white/10">0{index + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{problem.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{problem.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOLUTION ================= */}
      <section id="solution" className="scroll-mt-32 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-success-600">
              Our solution
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              So we rebuilt it, properly
            </h2>
            <p className="mt-3 text-ink-600">
              Every problem above has a direct answer on this platform. Nothing hand-waved.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SOLUTIONS.map((solution, index) => (
              <div key={solution.title} className="card relative p-5">
                <span className="absolute -top-3 left-5 grid size-7 place-items-center rounded-full bg-success-500 text-xs font-bold text-white ring-4 ring-white">
                  {index + 1}
                </span>
                <span className="mt-2 grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <solution.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{solution.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{solution.body}</p>
              </div>
            ))}
          </div>

          {/* How it works strip */}
          <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Jar, title: "Select", blurb: "Pick cans, bottles, a camper or a tanker trip." },
              { icon: Check, title: "Confirm", blurb: "Verify by OTP, drop your pin, choose how to pay." },
              { icon: MapPin, title: "Track", blurb: "Follow your driver on the map, live." },
              { icon: WaterDrop, title: "Delivered", blurb: "Water at your door, every single time." },
            ].map((step, index) => (
              <li key={step.title} className="relative text-center">
                <div className="relative z-10 mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-md">
                  <step.icon className="size-6" />
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-500">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-semibold text-ink-900">{step.title}</h3>
                <p className="mx-auto mt-1.5 max-w-52 text-sm leading-relaxed text-ink-500">
                  {step.blurb}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= QUICK ORDER ================= */}
      <QuickOrder />

      {/* ================= WHY US ================= */}
      <section id="why" className="scroll-mt-32 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why JAL 24×7"
            title="What makes this different"
            subtitle="Six things a phone call to a local vendor simply cannot give you."
            centred
          />

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_US.map((item) => (
              <div
                key={item.title}
                className="card group relative overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-(--shadow-lift)"
              >
                <span
                  aria-hidden
                  className="absolute -right-6 -top-6 size-24 rounded-full bg-brand-50 transition-transform group-hover:scale-125"
                />
                <span className="relative grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-sm">
                  <item.icon className="size-6" />
                </span>
                <h3 className="relative mt-4 font-semibold text-ink-900">{item.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-500">{item.body}</p>
                <p className="relative mt-4 inline-flex items-center gap-1.5 rounded-lg bg-success-50 px-2.5 py-1 text-xs font-bold text-success-600">
                  <Check className="size-3.5" strokeWidth={3} />
                  {item.stat}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section id="faq" className="scroll-mt-32 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions people actually ask"
            subtitle="Everything about timing, pricing, cans, tankers and payments, answered plainly."
            centred
          />
          <FaqAccordion items={FAQS} />

          <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h3 className="font-semibold text-ink-900">Still have a question?</h3>
              <p className="mt-1 text-sm text-ink-500">
                Our team replies within 24 hours on working days.
              </p>
            </div>
            <Link href="/contact">
              <Button variant="secondary">Contact us</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ================= BIG WORDMARK ================= */}
      <BigWordmark />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centred = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  centred?: boolean;
}) {
  return (
    <div className={cx("mb-8", centred && "mx-auto max-w-2xl text-center")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-500 sm:text-base">{subtitle}</p>}
    </div>
  );
}

/** The floating order card beside the hero copy. */
function HeroCard({ featured }: { featured: Product[] }) {
  return (
    <div className="relative animate-(--animate-fade-up) [animation-delay:120ms]">
      <div className="card relative overflow-hidden p-5 shadow-(--shadow-lift)">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-900">Popular right now</p>
          <Badge tone="success">In stock</Badge>
        </div>

        <div className="mt-4 space-y-2.5">
          {featured.length === 0
            ? [0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)
            : featured.map((product) => (
                <Link
                  key={product.id}
                  href={`/products?category=${product.category}`}
                  className="flex items-center gap-3 rounded-xl bg-brand-50/70 p-2.5 transition-colors hover:bg-brand-100/70"
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
                    <Image
                      src={product.image_url || "/images/products/can-20l.jpg"}
                      alt={product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {product.name}
                    </span>
                    <span className="text-xs text-ink-500">
                      {product.capacity_l}L
                      {product.pack_size > 1 ? ` × ${product.pack_size}` : ""} ·{" "}
                      {product.eta_minutes} min
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-brand-700">
                    {money(product.price)}
                  </span>
                </Link>
              ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-brand-200 bg-white p-3">
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <MapPin className="size-4 shrink-0 text-brand-500" />
            Drop your pin and we match the nearest verified supplier automatically.
          </div>
        </div>

        <Link href="/products" className="mt-4 block">
          <Button fullWidth size="lg">
            Start an order
          </Button>
        </Link>
      </div>

      <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-(--shadow-lift) sm:block">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-success-50 text-success-600">
            <Clock className="size-5" />
          </span>
          <div>
            <p className="text-xs text-ink-400">Typical can delivery</p>
            <p className="text-sm font-bold text-ink-900">Under 40 minutes</p>
          </div>
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
    } catch {
      toastError("PIN code lookup is unavailable right now.");
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
    <section id="order" className="scroll-mt-32 py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Quick order"
          title="Book water in three fields"
          subtitle="Pick what you need, how many, and where. Nothing else to fill in."
          centred
        />

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
                    <p className="mt-0.5 text-xs text-white/80">{selected.description}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-xs text-white/70">Total for {quantity}</p>
                        <p className="text-2xl font-bold">{money(selected.price * quantity)}</p>
                      </div>
                      <span className="rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold backdrop-blur">
                        <Clock className="mr-1 inline size-3" />
                        {selected.eta_minutes} min
                      </span>
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
            { href: "/events", icon: Calendar, label: "Plan an event", detail: "Party and function desk" },
            { href: "/subscriptions", icon: Repeat, label: "Set up a subscription", detail: "Daily or weekly" },
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
      </div>
    </section>
  );
}
