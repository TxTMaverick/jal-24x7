import type { Metadata } from "next";
import Link from "next/link";

import { MadeInIndia } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data JAL 24x7 collects, why, and how it is protected.",
};

const COLLECTED = [
  {
    what: "Mobile number",
    why: "Verifying your identity by OTP and letting the delivery partner reach you.",
    kept: "Until you ask us to delete the account.",
  },
  {
    what: "Name",
    why: "So the supplier knows who to ask for at the door.",
    kept: "Stored with each order as a historical record.",
  },
  {
    what: "Delivery address and map pin",
    why: "Routing the delivery and matching you to the nearest supplier.",
    kept: "Saved addresses until you delete them; a copy stays on past orders.",
  },
  {
    what: "Order history",
    why: "Showing your orders, enabling reorder, and platform analytics.",
    kept: "Retained as a business record.",
  },
  {
    what: "Email address",
    why: "Only if you use the contact form, so we can reply.",
    kept: "Until the enquiry is resolved.",
  },
];

const NOT_COLLECTED = [
  "Card numbers, CVV codes or UPI PINs. Payment details are validated for format and immediately discarded.",
  "Precise location in the background. Location is read only when you tap a button that asks for it.",
  "Contacts, photos, files or any other data from your device.",
  "Advertising identifiers. There are no third-party trackers or advertising pixels on this site.",
];

const SECTIONS = [
  {
    heading: "How your data is protected",
    body: [
      "Passwords, where used, are hashed with PBKDF2-HMAC-SHA256 at 600,000 iterations and a unique salt per account. They are never stored or transmitted in readable form.",
      "Sessions use signed JSON Web Tokens with an expiry. A token identifies you but carries no sensitive data.",
      "Every text field you submit is sanitised on the server before it is stored, which strips markup and control characters. Database access uses parameter binding throughout, so query injection is not possible.",
      "The API sends strict security headers, applies per-address rate limits to login and ordering endpoints, and rejects oversized requests.",
    ],
  },
  {
    heading: "Who your data is shared with",
    body: [
      "The supplier assigned to your order receives your name, mobile number, delivery address and any note you added. They need these to complete the delivery, and nothing more is shared with them.",
      "We do not sell personal data, and we do not share it with advertisers or data brokers.",
      "Three external services are contacted by our server to improve the experience: Open-Meteo for weather at your delivery pin, OpenStreetMap Nominatim for turning a map pin into an address, and the India Post PIN code service. These calls are made by our backend and carry only coordinates or a PIN code, never your name, number or order.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "This site sets no tracking cookies. Your session token, your cart and a flag remembering whether the splash animation has played are stored in your browser's local storage.",
      "Clearing your browser data removes all of it and signs you out.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You can ask for a copy of the data held about you, ask for it to be corrected, or ask for your account and its data to be deleted. Send the request through the Contact page from the mobile number on the account.",
      "Order records may be retained after account deletion where required as a business or tax record, with personal identifiers removed.",
    ],
  },
  {
    heading: "Children",
    body: [
      "This service is intended for adults. We do not knowingly collect data from anyone under 18.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated 23 August 2026</p>

      <div className="card mt-6 border-accent-500/25 bg-accent-400/10 p-4">
        <p className="text-sm leading-relaxed text-ink-700">
          <strong className="text-ink-900">Demonstration build.</strong> This site runs payments in
          test mode and stores demonstration data only. No card details are ever collected or
          retained.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink-900">What we collect, and why</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-2xl text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Why we need it</th>
                <th className="px-4 py-3 font-semibold">How long we keep it</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {COLLECTED.map((row) => (
                <tr key={row.what}>
                  <td className="px-4 py-3 font-semibold text-ink-900">{row.what}</td>
                  <td className="px-4 py-3 text-ink-600">{row.why}</td>
                  <td className="px-4 py-3 text-ink-500">{row.kept}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink-900">What we never collect</h2>
        <ul className="card mt-3 divide-y divide-ink-100">
          {NOT_COLLECTED.map((item) => (
            <li key={item} className="flex items-start gap-3 p-4 text-sm text-ink-600">
              <span
                aria-hidden
                className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-danger-50 text-[10px] font-bold text-danger-600"
              >
                ✕
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-bold text-ink-900">{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index} className="mt-2 text-sm leading-relaxed text-ink-600">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 pt-6">
        <MadeInIndia />
        <Link href="/terms" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Read the Terms of Service →
        </Link>
      </div>
    </div>
  );
}
