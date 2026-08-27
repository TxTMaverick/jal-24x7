import type { Metadata } from "next";
import Link from "next/link";

import { MadeInIndia } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you book water through JAL 24x7.",
};

const SECTIONS = [
  {
    heading: "1. About this service",
    body: [
      "JAL 24×7 is an online platform that connects customers with independent, verified water suppliers. We are a marketplace: the water itself is supplied and delivered by the operator shown on your order, not by JAL 24×7 directly.",
      "This deployment is a demonstration build created for academic assessment. Payments run in test mode, no money is transferred, and no order results in a real delivery.",
    ],
  },
  {
    heading: "2. Placing an order",
    body: [
      "You must verify a mobile number by OTP before placing an order. You are responsible for keeping access to that number secure, and for the accuracy of the delivery address and pin you provide.",
      "All prices shown are calculated on our server at the moment you check out. A price displayed earlier in your session is indicative and may change if stock, distance or applicable taxes change.",
      "An order is confirmed only once payment succeeds or, for cash on delivery, once the supplier accepts it.",
    ],
  },
  {
    heading: "3. Pricing, taxes and delivery charges",
    body: [
      "Packaged products are priced per unit. Tankers are priced per trip, with a distance surcharge beyond a free radius of 8 kilometres. Goods and Services Tax is applied at the prevailing rate and shown as a separate line.",
      "Delivery is free on orders above ₹150. Below that a standard fee applies, and express dispatch carries a higher fee. Every charge is itemised before you pay.",
    ],
  },
  {
    heading: "4. Cancellations and refunds",
    body: [
      "You may cancel an order at any time before the supplier marks it as out for delivery. Reserved stock is released immediately on cancellation.",
      "Once a vehicle has left the depot the trip is under way and cancellation is no longer available through the platform. Contact the supplier directly in that case.",
      "In a live deployment, refunds for prepaid orders would be returned to the original payment method within seven working days.",
    ],
  },
  {
    heading: "5. Empty container exchange",
    body: [
      "Twenty litre cans and campers are supplied on an exchange basis. Hand the empty container to the delivery partner when the full one is delivered. First-time customers may be asked for a one-time refundable deposit instead.",
      "Damaged or missing containers may be charged at replacement cost by the supplier.",
    ],
  },
  {
    heading: "6. Supplier verification and water quality",
    body: [
      "Every supplier completes a KYC check before being listed, and each publishes their declared water source, purification stages and certifications.",
      "JAL 24×7 does not operate a testing laboratory. Quality information shown on a supplier profile is declared by that supplier. For a formal potability assessment, contact your municipal water department using the directory in the Contact section.",
    ],
  },
  {
    heading: "7. Acceptable use",
    body: [
      "Do not attempt to access another customer's orders, interfere with the platform's operation, submit automated or bulk requests, or upload content that is unlawful or misleading.",
      "We apply rate limits and input validation to protect the service. Accounts that abuse the platform may be suspended.",
    ],
  },
  {
    heading: "8. Limitation of liability",
    body: [
      "To the extent permitted by law, JAL 24×7's liability for any claim relating to an order is limited to the amount paid for that order.",
      "We are not liable for delays caused by weather, traffic, civic restrictions or supplier vehicle breakdown, though we will always help you reach an alternative supplier.",
    ],
  },
  {
    heading: "9. Changes to these terms",
    body: [
      "We may update these terms as the service develops. The date below reflects the current version, and continued use of the platform after an update constitutes acceptance.",
    ],
  },
  {
    heading: "10. Contact",
    body: [
      "Questions about these terms can be sent through the Contact page, and we aim to respond within one working day.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Legal</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated 23 August 2026</p>

      <div className="card mt-6 border-accent-500/25 bg-accent-400/10 p-4">
        <p className="text-sm leading-relaxed text-ink-700">
          <strong className="text-ink-900">Demonstration build.</strong> This site runs payments in
          test mode. No money is charged, no card details are stored, and no order produces a real
          water delivery.
        </p>
      </div>

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
        <Link href="/privacy" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Read the Privacy Policy →
        </Link>
      </div>
    </div>
  );
}
