"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cx } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import { Cart, Close, Menu, UserIcon, WaterDrop } from "./icons";
import { SplashOverlay } from "./Splash";

const NAV = [
  { href: "/products", label: "All Products" },
  { href: "/tankers", label: "Water Tankers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const { user, signOut } = useAuth();

  const [splash, setSplash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Close any open panel when the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <SplashOverlay visible={splash} onDone={() => setSplash(false)} />

      <header className="sticky top-0 z-50 border-b border-ink-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Wordmark: replays the splash instead of navigating (per the brief). */}
          <button
            type="button"
            onClick={() => setSplash(true)}
            className="group flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            aria-label="JAL 24x7, play splash animation"
          >
            <span className="relative grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
              <WaterDrop filled className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">
              JAL <span className="text-brand-600">24×7</span>
            </span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/cart"
              aria-label={`Cart${hydrated && count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
              className={cx(
                "relative grid size-10 place-items-center rounded-xl transition-colors",
                isActive("/cart")
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
              )}
            >
              <Cart className="size-5" />
              {hydrated && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white tabular-nums ring-2 ring-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className={cx(
                  "flex h-10 items-center gap-2 rounded-xl px-2.5 transition-colors",
                  accountOpen
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
                )}
              >
                <UserIcon className="size-5" />
                {user && (
                  <span className="hidden max-w-24 truncate text-sm font-medium sm:block">
                    {user.name.split(" ")[0]}
                  </span>
                )}
              </button>

              {accountOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setAccountOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-ink-100 bg-white p-1.5 shadow-(--shadow-lift)"
                  >
                    {user ? (
                      <>
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
                          <p className="text-xs text-ink-400">+91 {user.phone}</p>
                        </div>
                        <div className="my-1 h-px bg-ink-100" />
                        <MenuLink href="/orders">My Orders</MenuLink>
                        <MenuLink href="/subscriptions">My Subscriptions</MenuLink>
                        {user.role === "vendor" && <MenuLink href="/vendor">Vendor Panel</MenuLink>}
                        {user.role === "admin" && <MenuLink href="/admin">Admin Dashboard</MenuLink>}
                        <div className="my-1 h-px bg-ink-100" />
                        <button
                          type="button"
                          onClick={() => {
                            signOut();
                            setAccountOpen(false);
                          }}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50"
                        >
                          Sign out
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="px-3 py-2.5">
                          <p className="text-sm font-semibold text-ink-900">Welcome to JAL 24×7</p>
                          <p className="text-xs text-ink-400">Sign in to book and track water</p>
                        </div>
                        <div className="my-1 h-px bg-ink-100" />
                        <MenuLink href="/login">Login / Sign up</MenuLink>
                        <MenuLink href="/orders">Track an order</MenuLink>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="grid size-10 place-items-center rounded-xl text-ink-600 transition-colors hover:bg-ink-50 lg:hidden"
            >
              {menuOpen ? <Close className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-ink-100 bg-white px-4 py-3 lg:hidden">
            <ul className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx(
                      "block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-600 hover:bg-ink-50",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/orders"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50"
                >
                  My Orders
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>
    </>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block rounded-lg px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
    >
      {children}
    </Link>
  );
}
