"use client";

/**
 * Water Quality Info. a lightweight informational screen.
 *
 * Deliberately static: lab testing and IoT sensors are explicitly out of scope
 * for this phase. What it does do is surface the purification and certification
 * data each supplier already declares, so the "solving a real problem" angle is
 * visible without pretending to have data we do not have.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

import { Check, Jar, Shield, WaterDrop } from "@/components/icons";
import { Badge, Button, PageHeader, Rating, VerifiedBadge } from "@/components/ui";
import { api } from "@/lib/api";
import type { Vendor } from "@/lib/types";

const PURIFICATION_STAGES = [
  { title: "Sediment filtration", blurb: "Removes visible silt, sand and rust picked up in transit." },
  { title: "Activated carbon", blurb: "Strips chlorine, odour and organic compounds that affect taste." },
  { title: "Reverse osmosis (RO)", blurb: "Membrane filtration for dissolved salts and heavy metals." },
  { title: "UV sterilisation", blurb: "Inactivates bacteria and viruses without adding chemicals." },
  { title: "Mineral balancing", blurb: "Re-adds calcium and magnesium that RO strips out." },
];

const HOME_TIPS = [
  "Rinse and sun-dry a 20L can before a refill, most contamination happens in storage, not supply.",
  "Keep campers and cans out of direct sunlight; warmth encourages bacterial growth.",
  "Replace a household RO filter cartridge roughly every 6 months, or per the manufacturer.",
  "If water looks cloudy or smells of chlorine on arrival, refuse the delivery and report it.",
  "For a party or function, order chilled campers the same morning rather than the night before.",
];

const STANDARDS = [
  { code: "IS 10500", body: "Bureau of Indian Standards", detail: "Drinking water specification, the baseline every supplier should meet." },
  { code: "FSSAI licence", body: "Food Safety & Standards Authority of India", detail: "Required to commercially package and sell drinking water." },
  { code: "ISI mark", body: "Bureau of Indian Standards", detail: "Certifies packaged water conforms to IS 14543." },
];

export default function WaterQualityPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    api
      .vendors()
      .then(setVendors)
      .catch(() => setVendors([]));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Know your water"
        title="Water Quality Information"
        subtitle="What our suppliers treat, which standards apply in India, and how to keep water safe once it reaches you."
      />

      {/* Scope note, honest about what this page is and is not. */}
      <div className="card mb-6 flex items-start gap-3 bg-brand-50/70 p-4">
        <Shield className="mt-0.5 size-5 shrink-0 text-brand-600" />
        <p className="text-xs leading-relaxed text-ink-600">
          <span className="font-semibold text-ink-900">A note on scope. </span>
          JAL 24×7 does not run its own laboratory testing or IoT sensing, that is explicitly out
          of scope for this phase. The information below reflects what each verified supplier
          declares during KYC, plus general public-health guidance. For a formal potability report,
          contact your municipal water department.
        </p>
      </div>

      {/* Purification stages */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-ink-900">How the water is treated</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PURIFICATION_STAGES.map((stage, index) => (
            <li key={stage.title} className="card p-4">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-3 font-semibold text-ink-900">{stage.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{stage.blurb}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Standards */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-ink-900">Standards that apply in India</h2>
        <div className="space-y-2.5">
          {STANDARDS.map((standard) => (
            <div key={standard.code} className="card flex flex-wrap items-start gap-3 p-4">
              <Badge tone="brand">{standard.code}</Badge>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900">{standard.body}</p>
                <p className="mt-0.5 text-xs text-ink-500">{standard.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Per-supplier declarations */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-bold text-ink-900">What each supplier declares</h2>
        <p className="mb-4 text-sm text-ink-500">
          Source, certifications and last self-reported test date, captured at KYC.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {vendors.length === 0
            ? [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)
            : vendors.map((vendor) => (
                <article key={vendor.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{vendor.name}</h3>
                    {vendor.is_verified && <VerifiedBadge />}
                  </div>
                  <div className="mt-1.5">
                    <Rating value={vendor.rating} count={vendor.rating_count} />
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-ink-100 pt-3 text-xs">
                    <Row label="Water source" value={vendor.water_source} />
                    <Row label="Certifications" value={vendor.certifications} />
                    <Row label="Last tested" value={vendor.last_tested_on ?? "Not reported"} />
                  </dl>
                </article>
              ))}
        </div>
      </section>

      {/* Home tips */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-ink-900">Keeping water safe at home</h2>
        <ul className="card divide-y divide-ink-100">
          {HOME_TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-3 p-4">
              <Check className="mt-0.5 size-4 shrink-0 text-success-500" strokeWidth={3} />
              <span className="text-sm leading-relaxed text-ink-600">{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="card flex flex-wrap items-center justify-between gap-4 bg-linear-to-r from-brand-50 to-white p-6">
        <div className="flex items-start gap-3">
          <WaterDrop filled className="mt-0.5 size-8 shrink-0 text-brand-600" />
          <div>
            <h3 className="font-semibold text-ink-900">Ready to order?</h3>
            <p className="mt-1 text-sm text-ink-500">
              Every supplier listed on JAL 24×7 has passed KYC verification.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/products">
            <Button>
              <Jar className="size-4" />
              Browse products
            </Button>
          </Link>
          <Link href="/suppliers">
            <Button variant="secondary">Compare suppliers</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium text-ink-700">{value}</dd>
    </div>
  );
}
