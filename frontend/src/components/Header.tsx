"use client";

/**
 * Site header.
 *
 * Deliberately minimal: a wordmark, the cart, the account menu and one
 * hamburger. Every destination lives inside the drawer at every breakpoint,
 * so the top bar never turns into a row of competing links.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { warmUp } from "@/lib/api";
import { cx } from "@/lib/format";
import { useAuth } from "@/store/auth";
import { useCart } from "@/store/cart";
import {
  Building,
  Cart,
  Close,
  Jar,
  Menu,
  Phone,
  Repeat,
  Truck,
  UserIcon,
  WaterDrop,
  type IconProps,
} from "./icons";
import { SplashOverlay } from "./Splash";

interface NavItem {
  href: string;
  label: string;
  detail: string;
  icon: (props: IconProps) => React.ReactElement;
}

/** The drawer, in the order the sections run on the site. */
const NAV: NavItem[] = [
  { href: "/#about", label: "About", detail: "What JAL 24×7 is", icon: WaterDrop },
  { href: "/products", label: "Products", detail: "Cans, bottles, campers", icon: Jar },
  { href: "/tankers", label: "Water Tankers", detail: "Booking and availability", icon: Truck },
  { href: "/suppliers", label: "Suppliers", detail: "Verified operators near you", icon: Building },
  { href: "/subscriptions", label: "Subscriptions", detail: "Monthly and recurring", icon: Repeat },
  { href: "/orders", label: "Orders", detail: "Track and reorder", icon: Cart },
  { href: "/contact", label: "Contact", detail: "Helplines and support", icon: Phone },
];

export function Header() {
  const pathname = usePathname();
  const { count, hydrated } = useCart();
  const { user, signOut } = useAuth();

  const [splash, setSplash] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Nudge the backend awake the moment the app mounts, so a sleeping free
  // instance is already booting while the visitor reads the landing page
  // rather than starting only when they press their first button.
  useEffect(() => {
    warmUp();
  }, []);

  // Close any open panel when the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // The drawer covers the page, so the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Escape closes the drawer, as every drawer should.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const isActive = (href: string) => {
    const path = href.split("#")[0];
    if (path === "/") return pathname === "/";
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <>
      <SplashOverlay visible={splash} onDone={() => setSplash(false)} />

      <header className="sticky top-0 z-50 border-b border-ink-100/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          {/* Wordmark: home from anywhere, which is what people expect of a
              logo. Already on home, there is nowhere to go, so it replays the
              intro animation instead of doing nothing. */}
          <Link
            href="/"
            onClick={(event) => {
              if (pathname === "/") {
                event.preventDefault();
                setSplash(true);
              }
            }}
            className="group flex shrink-0 items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            aria-label={pathname === "/" ? "JAL 24x7, replay the intro animation" : "JAL 24x7, go to the home page"}
          >
            <span className="relative grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm transition-transform group-hover:scale-105 group-active:scale-95">
              <WaterDrop filled className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">
              JAL <span className="text-brand-600">24×7</span>
            </span>
          </Link>

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
              className={cx(
                "grid size-10 place-items-center rounded-xl transition-colors",
                menuOpen
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
              )}
            >
              {menuOpen ? <Close className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <NavDrawer
          items={NAV}
          isActive={isActive}
          signedIn={Boolean(user)}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </>
  );
}

/** Full-height slide-in panel holding every destination on the site. */
function NavDrawer({
  items,
  isActive,
  signedIn,
  onClose,
}: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  signedIn: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-sm animate-(--animate-fade-up)"
        onClick={onClose}
        aria-hidden
      />

      <nav
        aria-label="Site menu"
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-(--shadow-lift) animate-(--animate-slide-in)"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 px-4">
          <span className="text-sm font-semibold text-ink-400">Menu</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-10 place-items-center rounded-xl text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <Close className="size-5" />
          </button>
        </div>

        <ul className="flex-1 overflow-y-auto p-3">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                  isActive(item.href) ? "bg-brand-50" : "hover:bg-ink-50",
                )}
              >
                <span
                  className={cx(
                    "grid size-10 shrink-0 place-items-center rounded-xl transition-colors",
                    isActive(item.href)
                      ? "bg-brand-600 text-white"
                      : "bg-ink-50 text-ink-500",
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      "block text-sm font-semibold",
                      isActive(item.href) ? "text-brand-700" : "text-ink-900",
                    )}
                  >
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-ink-400">{item.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="shrink-0 border-t border-ink-100 p-3">
          <Link
            href={signedIn ? "/products" : "/login"}
            onClick={onClose}
            className="flex h-12 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {signedIn ? "Order water now" : "Login / Sign up"}
          </Link>
        </div>
      </nav>
    </div>
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
