import Link from "next/link";

import { IndiaFlag } from "./Brand";
import { WaterDrop } from "./icons";

const COLUMNS = [
  {
    title: "Order",
    links: [
      { href: "/products?category=can", label: "20L Water Cans" },
      { href: "/products?category=bottle", label: "Bottles & Packs" },
      { href: "/products?category=camper", label: "Water Campers" },
      { href: "/tankers", label: "Water Tankers" },
      { href: "/subscriptions", label: "Daily Subscriptions" },
    ],
  },
  {
    title: "Discover",
    links: [
      { href: "/suppliers", label: "Suppliers Near You" },
      { href: "/drivers", label: "Tanker Drivers" },
      { href: "/events", label: "Party & Event Booking" },
      { href: "/water-quality", label: "Water Quality Info" },
      { href: "/contact#directory", label: "Govt. Water Helplines" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/orders", label: "My Orders" },
      { href: "/cart", label: "My Cart" },
      { href: "/login", label: "Login or Sign Up" },
      { href: "/vendor", label: "Vendor Panel" },
      { href: "/admin", label: "Admin Dashboard" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-12 border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">
                <WaterDrop filled className="size-5" />
              </span>
              <span className="text-lg font-bold tracking-tight text-ink-900">
                JAL <span className="text-brand-600">24×7</span>
              </span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-500">
              On-demand water delivery and booking. Tankers, cans and campers from verified local
              suppliers, any time, anywhere.
            </p>

            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-brand-50 p-3">
              <IndiaFlag className="h-6 w-9 shrink-0" />
              <div>
                <p className="text-sm font-bold text-ink-900">Made in India</p>
                <p className="text-xs text-ink-500">Built for Indian homes and cities</p>
              </div>
            </div>

            <p className="mt-4 text-xs text-ink-400">
              Serving Indore and surrounding areas · Emergency helpline 1916
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-900">
                {column.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ink-500 transition-colors hover:text-brand-600"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar: copyright on the left, legal links on the right. */}
        <div className="mt-6 flex flex-col-reverse gap-4 border-t border-ink-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} JAL 24×7. All rights reserved.
          </p>

          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/terms"
              className="text-xs font-medium text-ink-500 transition-colors hover:text-brand-600"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-xs font-medium text-ink-500 transition-colors hover:text-brand-600"
            >
              Privacy Policy
            </Link>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <IndiaFlag className="h-3 w-4.5" />
              India
            </span>
          </nav>
        </div>
      </div>
    </footer>
  );
}
