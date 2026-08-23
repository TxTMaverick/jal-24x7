/** Shared API types. mirrors the FastAPI Pydantic schemas. */

export type Category = "bottle" | "can" | "camper";
export type DeliverySpeed = "instant" | "same_day" | "scheduled";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "vendor_assigned"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: Category;
  description: string;
  capacity_l: number;
  pack_size: number;
  price: number;
  mrp: number | null;
  image: string;
  image_url: string;
  delivery_speed: DeliverySpeed;
  eta_minutes: number;
  stock: number;
}

export interface TankerTier {
  id: number;
  code: string;
  capacity_l: number;
  segment: "individual" | "society";
  base_price: number;
  description: string;
  eta_minutes: number;
  image_url: string;
}

export interface Vendor {
  id: number;
  name: string;
  tagline: string;
  phone: string;
  is_verified: boolean;
  kyc_status: string;
  rating: number;
  rating_count: number;
  completed_orders: number;
  lat: number;
  lng: number;
  city: string;
  service_zones: string;
  min_capacity_l: number;
  max_capacity_l: number;
  price_per_trip: number;
  is_online: boolean;
  supports_events: boolean;
  area: string;
  event_contact_name: string | null;
  active_load: number;
  capacity_per_slot: number;
  water_source: string;
  certifications: string;
  last_tested_on: string | null;
}

export interface VendorMatch {
  vendor: Vendor;
  distance_km: number;
  score: number;
  eta_minutes: number;
  reasons: string[];
  breakdown: Record<string, number>;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  role: "customer" | "vendor" | "admin";
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
  is_new_user: boolean;
}

export interface CartLineIn {
  item_type: "product" | "tanker";
  product_id?: number | null;
  tanker_tier_id?: number | null;
  quantity: number;
}

export interface QuoteLine {
  item_type: string;
  reference_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  capacity_l: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  discount_label: string;
  delivery_fee: number;
  distance_surcharge: number;
  tax: number;
  total: number;
  total_litres: number;
  distance_km: number;
}

export interface OrderItem {
  id: number;
  item_type: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  capacity_l: number;
}

export interface OrderEvent {
  status: string;
  note: string;
  created_at: string;
}

export interface Order {
  id: number;
  order_code: string;
  order_type: string;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  tax: number;
  total: number;
  contact_name: string;
  contact_phone: string;
  address_line: string;
  address_city: string;
  address_pincode: string;
  address_lat: number;
  address_lng: number;
  delivery_slot: string | null;
  scheduled_for: string | null;
  is_express: boolean;
  notes: string | null;
  payment_method: string;
  payment_status: string;
  payment_ref: string | null;
  eta_minutes: number;
  courier_lat: number | null;
  courier_lng: number | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  events: OrderEvent[];
  vendor: Vendor | null;
}

export interface Tracking {
  order_code: string;
  status: OrderStatus;
  status_index: number;
  flow: string[];
  eta_minutes: number;
  courier_lat: number | null;
  courier_lng: number | null;
  destination_lat: number;
  destination_lng: number;
  vendor_name: string | null;
  progress: number;
  events: OrderEvent[];
}

export interface Subscription {
  id: number;
  plan_type: "camper" | "society_tanker";
  frequency: string;
  quantity: number;
  contact_name: string;
  contact_phone: string;
  address_line: string;
  preferred_window: string;
  start_date: string;
  society_name: string | null;
  units_count: number | null;
  estimated_cycle_cost: number;
  status: string;
  created_at: string;
}

export interface SubscriptionEstimate {
  unit_price: number;
  quantity: number;
  deliveries_per_month: number;
  gross_cost: number;
  discount_rate: number;
  estimated_cycle_cost: number;
  savings: number;
}

export interface WaterDepartment {
  id: number;
  zone: string;
  city: string;
  office_name: string;
  address: string;
  helpline: string;
  tanker_request_line: string;
  billing_line: string | null;
  lat: number | null;
  lng: number | null;
}

export interface AdminStats {
  total_orders: number;
  active_orders: number;
  delivered_today: number;
  total_revenue: number;
  vendors_total: number;
  vendors_online: number;
  vendors_pending_kyc: number;
  orders_by_status: Record<string, number>;
  demand_by_service: Record<string, number>;
  revenue_last_7_days: { date: string; revenue: number }[];
  total_litres_delivered: number;
}

export interface Address {
  id: number;
  label: string;
  line1: string;
  landmark: string | null;
  city: string;
  pincode: string;
  zone: string | null;
  lat: number;
  lng: number;
  is_default: boolean;
}

// --------------------------------------------------------------------------
// Tanker drivers
// --------------------------------------------------------------------------

export interface TankerDriver {
  id: number;
  vendor_id: number;
  name: string;
  phone: string;
  photo_url: string;
  vehicle_number: string;
  vehicle_capacity_l: number;
  licence_number: string;
  experience_years: number;
  rating: number;
  trips_completed: number;
  languages: string;
  shift: string;
  is_available: boolean;
}

export interface DriverWithOperator {
  driver: TankerDriver;
  operator_name: string;
  operator_phone: string;
  operator_verified: boolean;
  operator_rating: number;
  distance_km: number | null;
}

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------

export interface EventContact {
  vendor: Vendor;
  distance_km: number;
  contact_person: string;
  contact_phone: string;
  area: string;
  min_guests: number;
  max_guests: number;
  suggested_litres: number;
  suggested_campers: number;
  estimated_cost: number;
}

export interface EventSizing {
  guests: number;
  hours: number;
  is_summer: boolean;
  total_litres: number;
  campers_100l: number;
  cans_20l: number;
  bottles_1l: number;
  note: string;
}

// --------------------------------------------------------------------------
// Payments
// --------------------------------------------------------------------------

export interface PaymentOption {
  id: string;
  label: string;
  kind: "upi_app" | "upi_id" | "card" | "netbanking" | "wallet" | "cod";
  icon: string;
  detail: string;
  is_installed: boolean;
  popular: boolean;
}

export interface PaymentMethods {
  upi_apps: PaymentOption[];
  netbanking: PaymentOption[];
  cards: PaymentOption[];
  others: PaymentOption[];
  note: string;
}

export interface PayResult {
  success: boolean;
  payment_ref: string;
  method_label: string;
  amount: number;
  paid_at: string;
  signature: string;
  order: Order;
}

// --------------------------------------------------------------------------
// Integrations
// --------------------------------------------------------------------------

export interface WeatherInfo {
  available: boolean;
  temperature_c: number | null;
  feels_like_c?: number | null;
  max_today_c?: number | null;
  humidity: number | null;
  condition: string;
  demand_level: "normal" | "elevated" | "high" | "extreme";
  advice: string;
  suggested_multiplier: number;
  source: string;
}

export interface ReverseGeocode {
  available: boolean;
  display_name: string;
  address_line: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  source: string;
}

export interface PincodeInfo {
  available: boolean;
  detail?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  region?: string;
  localities?: string[];
  source?: string;
}
