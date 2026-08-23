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
 * Render's blueprint passes a bare hostname (jal24x7-api.onrender.com) when one
 * service references another, so a missing scheme is filled in as https.
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
    return "Cannot reach the server. Is the backend running on port 8000?";
  }
  return `Request failed (HTTP ${status}).`;
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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
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
