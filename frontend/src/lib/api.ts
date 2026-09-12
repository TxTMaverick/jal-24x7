/**
 * Typed API client for the JAL 24x7 FastAPI backend.
 *
 * One place that knows the base URL, attaches the bearer token, and turns
 * FastAPI's error shapes into a plain `Error` with a readable message. so
 * every screen can just `try { ... } catch (e) { toast(e.message) }`.
 */

import type {
  Address,
  AdminStats,
  CartLineIn,
  DriverWithOperator,
  EventContact,
  EventSizing,
  PayResult,
  PaymentMethods,
  PincodeInfo,
  ReverseGeocode,
  WeatherInfo,
  Order,
  Product,
  Quote,
  Subscription,
  SubscriptionEstimate,
  TankerTier,
  TokenResponse,
  Tracking,
  User,
  Vendor,
  VendorMatch,
  WaterDepartment,
} from "./types";

/**
 * Base URL of the FastAPI backend.
 *
 * Defaults to the local backend. A hostname given without a scheme is assumed
 * to be https, since some hosting platforms hand one service another service's
 * bare hostname.
 */
function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE?.trim();
  if (!raw) return "http://localhost:8000";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/$/, "");
}

export const API_BASE = resolveApiBase();

const TOKEN_KEY = "jal24x7_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/** FastAPI returns `detail` as a string, or an array of validation errors. */
function readError(status: number, body: unknown): string {
  if (typeof body === "string" && body) return body;
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string; loc?: unknown[] } | undefined;
      if (first?.msg) {
        const field = Array.isArray(first.loc) ? first.loc.slice(1).join(".") : "";
        const msg = first.msg.replace(/^Value error,\s*/, "");
        return field ? `${field}: ${msg}` : msg;
      }
    }
  }
  if (status === 0) {
    // In development the usual cause is a backend that was never started.
    // In production the instance stayed asleep for longer than we waited.
    return IS_LOCAL
      ? "Cannot reach the server. Start the backend with: uvicorn app.main:app --reload"
      : "The server did not wake up in time. It is still starting, so please try again in a moment.";
  }
  return `Request failed (HTTP ${status}).`;
}

// --------------------------------------------------------------------------
// Cold starts
//
// A free Render instance spins down after 15 minutes idle and takes the best
// part of a minute to come back. The old client gave up after ~4 seconds, so
// the very first request of a session always failed and "try again" simply
// failed again a few seconds later. Instead we keep retrying for as long as a
// cold boot realistically takes, and let the UI subscribe to that so it can
// say "waking up" instead of showing an error the user cannot act on.
// --------------------------------------------------------------------------

export const IS_LOCAL = /localhost|127\.0\.0\.1/.test(API_BASE);

/** How long to keep trying before admitting defeat. */
const WAKE_BUDGET_MS = IS_LOCAL ? 6_000 : 90_000;

/** Pauses between attempts, in ms. The tail repeats until the budget runs out. */
const BACKOFF_MS = [700, 1_500, 3_000, 5_000, 7_000, 9_000];

/** Upstream statuses that mean "still booting", not "this request is wrong". */
const WAKING_STATUSES = new Set([502, 503, 504]);

type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
let wakingCount = 0;

/** Subscribe to cold-start state. Returns an unsubscribe function. */
export function onServerWaking(listener: WakeListener): () => void {
  wakeListeners.add(listener);
  listener(wakingCount > 0);
  return () => wakeListeners.delete(listener);
}

function setWaking(waking: boolean) {
  const before = wakingCount > 0;
  wakingCount = Math.max(0, wakingCount + (waking ? 1 : -1));
  const after = wakingCount > 0;
  if (before !== after) {
    for (const listener of wakeListeners) listener(after);
  }
}

let warmed = false;

/**
 * Nudge the backend awake without blocking anything.
 *
 * Called as soon as the app mounts, so the instance is already booting while
 * the visitor reads the landing page rather than starting only when they hit
 * their first button.
 */
export function warmUp(): void {
  if (warmed || typeof window === "undefined") return;
  warmed = true;
  void fetch(`${API_BASE}/health`, { cache: "no-store" }).catch(() => {
    // Expected while the instance is still asleep; the retry loop covers it.
  });
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = false, query, headers, ...rest } = options;

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string> | undefined),
  };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const request: RequestInit = {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  };

  // Keep retrying for as long as a cold boot plausibly takes. Both failure
  // shapes are treated the same: a refused connection while the instance is
  // down, and a 502/503/504 from the router while it is coming up.
  const deadline = Date.now() + WAKE_BUDGET_MS;
  let response: Response | undefined;
  let announcedWaking = false;
  let attempt = 0;

  try {
    for (;;) {
      let stillBooting = false;
      try {
        const candidate = await fetch(url.toString(), request);
        if (!WAKING_STATUSES.has(candidate.status)) {
          response = candidate;
          break;
        }
        stillBooting = true;
      } catch {
        stillBooting = true;
      }

      void stillBooting;
      const pause = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      if (Date.now() + pause >= deadline) break;

      // Only tell the UI once we have actually failed, so a healthy request
      // never flashes a "waking up" banner.
      if (!announcedWaking) {
        announcedWaking = true;
        setWaking(true);
      }
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  } finally {
    if (announcedWaking) setWaking(false);
  }

  if (!response) {
    throw new Error(readError(0, null));
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    // A dead token should log the user out rather than loop on 401s.
    if (response.status === 401 && auth) setToken(null);
    throw new Error(readError(response.status, parsed));
  }
  return parsed as T;
}

/** WebSocket URL for live order tracking. */
export function trackingSocketUrl(orderCode: string): string {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/api/orders/${orderCode}/ws`;
}

// --------------------------------------------------------------------------
// Endpoints
// --------------------------------------------------------------------------

export const api = {
  // --- catalogue ---
  products: (params?: Record<string, string | number | undefined>) =>
    apiFetch<Product[]>("/api/products", { query: params }),
  product: (id: number) => apiFetch<Product>(`/api/products/${id}`),
  tankers: (segment?: "individual" | "society") =>
    apiFetch<TankerTier[]>("/api/tankers", { query: { segment } }),
  quote: (payload: {
    lines: CartLineIn[];
    lat?: number;
    lng?: number;
    is_express?: boolean;
    is_society?: boolean;
  }) => apiFetch<Quote>("/api/quote", { method: "POST", body: payload }),

  // --- marketplace ---
  nearbyVendors: (params: {
    lat: number;
    lng: number;
    radius_km?: number;
    verified_only?: boolean;
    needs_tanker?: boolean;
    capacity_l?: number;
    sort?: "best" | "nearest" | "price" | "rating";
  }) => apiFetch<VendorMatch[]>("/api/vendors/nearby", { query: params }),
  vendor: (id: number) => apiFetch<Vendor>(`/api/vendors/${id}`),
  vendors: () => apiFetch<Vendor[]>("/api/vendors"),

  // --- auth ---
  requestOtp: (phone: string, name?: string) =>
    apiFetch<{ message: string; expires_in_seconds: number; demo_otp: string | null }>(
      "/api/auth/otp/request",
      { method: "POST", body: { phone, name } },
    ),
  verifyOtp: (phone: string, code: string, name?: string) =>
    apiFetch<TokenResponse>("/api/auth/otp/verify", {
      method: "POST",
      body: { phone, code, name },
    }),
  me: () => apiFetch<User>("/api/auth/me", { auth: true }),
  addresses: () => apiFetch<Address[]>("/api/auth/addresses", { auth: true }),
  createAddress: (payload: Partial<Address>) =>
    apiFetch<Address>("/api/auth/addresses", { method: "POST", body: payload, auth: true }),

  // --- orders ---
  createOrder: (payload: Record<string, unknown>) =>
    apiFetch<Order>("/api/orders", { method: "POST", body: payload, auth: true }),
  payOrder: (code: string) =>
    apiFetch<Order>(`/api/orders/${code}/pay`, { method: "POST", auth: true }),
  myOrders: (status?: string) =>
    apiFetch<Order[]>("/api/orders", { auth: true, query: { status } }),
  order: (code: string) => apiFetch<Order>(`/api/orders/${code}`, { auth: true }),
  cancelOrder: (code: string) =>
    apiFetch<Order>(`/api/orders/${code}/cancel`, { method: "POST", auth: true }),
  reorder: (code: string) =>
    apiFetch<Order>(`/api/orders/${code}/reorder`, { method: "POST", auth: true }),
  tracking: (code: string) => apiFetch<Tracking>(`/api/orders/${code}/tracking`),

  // --- subscriptions ---
  subscriptionEstimate: (params: {
    plan_type: string;
    frequency: string;
    quantity: number;
    product_id?: number;
    tanker_tier_id?: number;
  }) =>
    apiFetch<SubscriptionEstimate>("/api/subscriptions/estimate", {
      method: "POST",
      query: params,
    }),
  createSubscription: (payload: Record<string, unknown>) =>
    apiFetch<Subscription>("/api/subscriptions", { method: "POST", body: payload, auth: true }),
  mySubscriptions: () => apiFetch<Subscription[]>("/api/subscriptions", { auth: true }),
  pauseSubscription: (id: number) =>
    apiFetch<Subscription>(`/api/subscriptions/${id}/pause`, { method: "POST", auth: true }),

  // --- contact & directory ---
  submitContact: (payload: { name: string; email: string; subject: string; message: string }) =>
    apiFetch<{ message: string }>("/api/contact", { method: "POST", body: payload }),
  waterDepartments: (city?: string) =>
    apiFetch<WaterDepartment[]>("/api/water-departments", { query: { city } }),
  nearestDepartment: (lat: number, lng: number) =>
    apiFetch<WaterDepartment | null>("/api/water-departments/nearest", { query: { lat, lng } }),

  // --- admin ---
  adminStats: () => apiFetch<AdminStats>("/api/admin/stats", { auth: true }),
  adminOrders: (status?: string) =>
    apiFetch<Order[]>("/api/admin/orders", { auth: true, query: { status } }),
  adminVendors: (kyc_status?: string) =>
    apiFetch<Vendor[]>("/api/admin/vendors", { auth: true, query: { kyc_status } }),
  decideKyc: (vendorId: number, decision: "approve" | "reject") =>
    apiFetch<Vendor>(`/api/admin/vendors/${vendorId}/kyc`, {
      method: "POST",
      body: { decision },
      auth: true,
    }),

  // --- tanker drivers ---
  drivers: (params?: {
    lat?: number;
    lng?: number;
    capacity_l?: number;
    vendor_id?: number;
    available_only?: boolean;
  }) => apiFetch<DriverWithOperator[]>("/api/drivers", { query: params }),
  driver: (id: number) => apiFetch<DriverWithOperator>(`/api/drivers/${id}`),

  // --- events ---
  eventContacts: (params: { lat: number; lng: number; guests: number; radius_km?: number }) =>
    apiFetch<EventContact[]>("/api/events/contacts", { query: params }),
  eventSizing: (params: { guests: number; hours: number; is_summer?: boolean }) =>
    apiFetch<EventSizing>("/api/events/sizing", { query: params }),

  // --- payments ---
  paymentMethods: () => apiFetch<PaymentMethods>("/api/payments/methods"),
  pay: (
    code: string,
    payload: {
      method_id: string;
      upi_id?: string;
      bank_code?: string;
      card_number?: string;
      card_holder?: string;
    },
  ) => apiFetch<PayResult>(`/api/payments/${code}/pay`, { method: "POST", body: payload, auth: true }),

  // --- integrations (free public APIs, proxied by the backend) ---
  weather: (lat: number, lng: number) =>
    apiFetch<WeatherInfo>("/api/integrations/weather", { query: { lat, lng } }),
  reverseGeocode: (lat: number, lng: number) =>
    apiFetch<ReverseGeocode>("/api/integrations/reverse-geocode", { query: { lat, lng } }),
  pincode: (pin: string) => apiFetch<PincodeInfo>(`/api/integrations/pincode/${pin}`),

  // --- vendor panel ---
  vendorProfile: () => apiFetch<Vendor>("/api/vendor/me", { auth: true }),
  updateVendorProfile: (payload: Record<string, unknown>) =>
    apiFetch<Vendor>("/api/vendor/me", { method: "PATCH", body: payload, auth: true }),
  vendorOrders: (activeOnly = false) =>
    apiFetch<Order[]>("/api/vendor/orders", { auth: true, query: { active_only: activeOnly } }),
  updateOrderStatus: (code: string, status: string, note = "") =>
    apiFetch<Order>(`/api/vendor/orders/${code}/status`, {
      method: "POST",
      body: { status, note },
      auth: true,
    }),
};
