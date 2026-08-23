"""Pydantic request/response models.

These are the API contract. Keeping them separate from the SQLAlchemy models
means we never accidentally leak a column (like `password_hash`) just because
someone added it to the table.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .security import is_valid_indian_mobile, normalise_phone
from .validators import clean_address, clean_multiline, clean_name, clean_text

ORM = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #


class PhoneField(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not is_valid_indian_mobile(v):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return normalise_phone(v)


class OtpRequest(PhoneField):
    name: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def _clean(cls, v):
        return clean_name(v) if v else None


class OtpResponse(BaseModel):
    message: str
    expires_in_seconds: int
    # Populated only when DEMO_MODE is on -- documented as a demo affordance.
    demo_otp: str | None = None


class OtpVerify(PhoneField):
    code: str = Field(min_length=4, max_length=6)
    name: str | None = Field(default=None, max_length=120)

    @field_validator("code")
    @classmethod
    def _digits_only(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if not digits:
            raise ValueError("The OTP should contain digits only.")
        return digits

    @field_validator("name")
    @classmethod
    def _clean(cls, v):
        return clean_name(v) if v else None


class PasswordLogin(BaseModel):
    identifier: str = Field(description="Phone number or email")
    password: str = Field(min_length=6)


class RegisterRequest(PhoneField):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    role: Literal["customer", "vendor"] = "customer"

    @field_validator("name")
    @classmethod
    def _clean(cls, v: str) -> str:
        cleaned = clean_name(v)
        if len(cleaned) < 2:
            raise ValueError("Enter your name.")
        return cleaned


class UserOut(BaseModel):
    model_config = ORM
    id: int
    name: str
    phone: str
    email: str | None
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    is_new_user: bool = False


# --------------------------------------------------------------------------- #
# Catalogue
# --------------------------------------------------------------------------- #


class ProductOut(BaseModel):
    model_config = ORM
    id: int
    sku: str
    name: str
    category: str
    description: str
    capacity_l: float
    pack_size: int
    price: float
    mrp: float | None
    image: str
    image_url: str
    delivery_speed: str
    eta_minutes: int
    stock: int


class TankerTierOut(BaseModel):
    model_config = ORM
    id: int
    code: str
    capacity_l: int
    segment: str
    base_price: float
    description: str
    eta_minutes: int
    image_url: str


class VendorOut(BaseModel):
    model_config = ORM
    id: int
    name: str
    tagline: str
    phone: str
    is_verified: bool
    kyc_status: str
    rating: float
    rating_count: int
    completed_orders: int
    lat: float
    lng: float
    city: str
    service_zones: str
    min_capacity_l: int
    max_capacity_l: int
    price_per_trip: float
    is_online: bool
    supports_events: bool
    area: str
    event_contact_name: str | None
    # Exposed so the vendor panel can show current load, and so the
    # marketplace can explain a "currently busy" ranking to the customer.
    active_load: int
    capacity_per_slot: int
    water_source: str
    certifications: str
    last_tested_on: str | None


class VendorMatchOut(BaseModel):
    vendor: VendorOut
    distance_km: float
    score: float
    eta_minutes: int
    reasons: list[str]
    breakdown: dict[str, float]


# --------------------------------------------------------------------------- #
# Cart / quoting
# --------------------------------------------------------------------------- #


class CartLineIn(BaseModel):
    item_type: Literal["product", "tanker"] = "product"
    product_id: int | None = None
    tanker_tier_id: int | None = None
    quantity: int = Field(default=1, ge=1, le=99)

    @field_validator("quantity")
    @classmethod
    def _cap(cls, v: int) -> int:
        return v


class QuoteRequest(BaseModel):
    lines: list[CartLineIn] = Field(min_length=1)
    lat: float | None = None
    lng: float | None = None
    is_express: bool = False
    is_society: bool = False


class QuoteLineOut(BaseModel):
    item_type: str
    reference_id: int
    name: str
    unit_price: float
    quantity: int
    line_total: float
    capacity_l: float


class QuoteOut(BaseModel):
    lines: list[QuoteLineOut]
    subtotal: float
    discount: float
    discount_label: str
    delivery_fee: float
    distance_surcharge: float
    tax: float
    total: float
    total_litres: float
    distance_km: float


# --------------------------------------------------------------------------- #
# Addresses
# --------------------------------------------------------------------------- #


class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=40)
    line1: str = Field(min_length=4, max_length=255)

    @field_validator("line1")
    @classmethod
    def _clean_line(cls, v: str) -> str:
        cleaned = clean_address(v)
        if len(cleaned) < 4:
            raise ValueError("Enter an address we can find.")
        return cleaned
    landmark: str | None = None
    city: str = "Indore"
    pincode: str = Field(default="452001", pattern=r"^\d{6}$")
    zone: str | None = None
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    is_default: bool = False


class AddressOut(AddressIn):
    model_config = ORM
    id: int


# --------------------------------------------------------------------------- #
# Orders
# --------------------------------------------------------------------------- #


class OrderCreate(BaseModel):
    lines: list[CartLineIn] = Field(min_length=1)
    order_type: Literal["products", "tanker"] = "products"

    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str
    address_line: str = Field(min_length=4, max_length=255)
    address_city: str = "Indore"
    address_pincode: str = Field(default="452001", pattern=r"^\d{6}$")
    address_lat: float = Field(ge=-90, le=90)
    address_lng: float = Field(ge=-180, le=180)

    delivery_slot: str | None = None
    scheduled_for: datetime | None = None
    is_express: bool = False
    is_society: bool = False
    notes: str | None = None
    payment_method: Literal["razorpay_test", "cod", "upi_test"] = "razorpay_test"
    preferred_vendor_id: int | None = None

    @field_validator("contact_phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not is_valid_indian_mobile(v):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return normalise_phone(v)

    @field_validator("contact_name")
    @classmethod
    def _clean_contact_name(cls, v: str) -> str:
        cleaned = clean_name(v)
        if len(cleaned) < 2:
            raise ValueError("Enter the name the delivery should be made to.")
        return cleaned

    @field_validator("address_line")
    @classmethod
    def _clean_address_line(cls, v: str) -> str:
        cleaned = clean_address(v)
        if len(cleaned) < 4:
            raise ValueError("Enter a delivery address we can find.")
        return cleaned

    @field_validator("address_city")
    @classmethod
    def _clean_city(cls, v: str) -> str:
        return clean_name(v, max_length=80) or "Indore"

    @field_validator("notes")
    @classmethod
    def _clean_notes(cls, v):
        return clean_text(v, max_length=300) if v else None


class OrderItemOut(BaseModel):
    model_config = ORM
    id: int
    item_type: str
    name: str
    unit_price: float
    quantity: int
    line_total: float
    capacity_l: float


class OrderEventOut(BaseModel):
    model_config = ORM
    status: str
    note: str
    created_at: datetime


class OrderOut(BaseModel):
    model_config = ORM
    id: int
    order_code: str
    order_type: str
    status: str
    subtotal: float
    discount: float
    delivery_fee: float
    tax: float
    total: float
    contact_name: str
    contact_phone: str
    address_line: str
    address_city: str
    address_pincode: str
    address_lat: float
    address_lng: float
    delivery_slot: str | None
    scheduled_for: datetime | None
    is_express: bool
    notes: str | None
    payment_method: str
    payment_status: str
    payment_ref: str | None
    eta_minutes: int
    courier_lat: float | None
    courier_lng: float | None
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = []
    events: list[OrderEventOut] = []
    vendor: VendorOut | None = None


class OrderStatusUpdate(BaseModel):
    status: str
    note: str = ""


class TrackingOut(BaseModel):
    order_code: str
    status: str
    status_index: int
    flow: list[str]
    eta_minutes: int
    courier_lat: float | None
    courier_lng: float | None
    destination_lat: float
    destination_lng: float
    vendor_name: str | None
    progress: float
    events: list[OrderEventOut]


# --------------------------------------------------------------------------- #
# Subscriptions
# --------------------------------------------------------------------------- #


class SubscriptionCreate(BaseModel):
    plan_type: Literal["camper", "society_tanker"]
    frequency: Literal["daily", "alternate", "weekly"] = "daily"
    quantity: int = Field(default=1, ge=1, le=200)
    product_id: int | None = None
    tanker_tier_id: int | None = None

    contact_name: str = Field(min_length=2, max_length=120)
    contact_phone: str
    address_line: str = Field(min_length=4, max_length=255)
    preferred_window: str = "07:00-09:00"
    start_date: str

    society_name: str | None = None
    units_count: int | None = Field(default=None, ge=1, le=5000)

    @field_validator("contact_phone")
    @classmethod
    def _validate_phone(cls, v: str) -> str:
        if not is_valid_indian_mobile(v):
            raise ValueError("Enter a valid 10-digit Indian mobile number.")
        return normalise_phone(v)

    @field_validator("contact_name", "society_name")
    @classmethod
    def _clean_names(cls, v):
        return clean_name(v) if v else v

    @field_validator("address_line")
    @classmethod
    def _clean_address_line(cls, v: str) -> str:
        cleaned = clean_address(v)
        if len(cleaned) < 4:
            raise ValueError("Enter a delivery address we can find.")
        return cleaned


class SubscriptionOut(BaseModel):
    model_config = ORM
    id: int
    plan_type: str
    frequency: str
    quantity: int
    contact_name: str
    contact_phone: str
    address_line: str
    preferred_window: str
    start_date: str
    society_name: str | None
    units_count: int | None
    estimated_cycle_cost: float
    status: str
    created_at: datetime


# --------------------------------------------------------------------------- #
# Contact & directory
# --------------------------------------------------------------------------- #


class ContactMessageIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(default="General enquiry", max_length=160)
    message: str = Field(min_length=10, max_length=2000)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        cleaned = clean_name(v)
        if len(cleaned) < 2:
            raise ValueError("Enter your name.")
        return cleaned

    @field_validator("subject")
    @classmethod
    def _clean_subject(cls, v: str) -> str:
        return clean_text(v, max_length=160) or "General enquiry"

    @field_validator("message")
    @classmethod
    def _clean_message(cls, v: str) -> str:
        cleaned = clean_multiline(v)
        if len(cleaned) < 10:
            raise ValueError(
                "Please give us a little more detail, at least 10 characters."
            )
        return cleaned


class WaterDepartmentOut(BaseModel):
    model_config = ORM
    id: int
    zone: str
    city: str
    office_name: str
    address: str
    helpline: str
    tanker_request_line: str
    billing_line: str | None
    lat: float | None
    lng: float | None


# --------------------------------------------------------------------------- #
# Tanker drivers
# --------------------------------------------------------------------------- #


class TankerDriverOut(BaseModel):
    model_config = ORM
    id: int
    vendor_id: int
    name: str
    phone: str
    photo_url: str
    vehicle_number: str
    vehicle_capacity_l: int
    licence_number: str
    experience_years: int
    rating: float
    trips_completed: int
    languages: str
    shift: str
    is_available: bool


class DriverWithOperator(BaseModel):
    """A driver plus the operator they work under."""

    driver: TankerDriverOut
    operator_name: str
    operator_phone: str
    operator_verified: bool
    operator_rating: float
    distance_km: float | None = None


# --------------------------------------------------------------------------- #
# Event / party booking contacts
# --------------------------------------------------------------------------- #


class EventContactOut(BaseModel):
    vendor: VendorOut
    distance_km: float
    contact_person: str
    contact_phone: str
    area: str
    min_guests: int
    max_guests: int
    suggested_litres: int
    suggested_campers: int
    estimated_cost: float


# --------------------------------------------------------------------------- #
# Payments
# --------------------------------------------------------------------------- #


class PaymentOption(BaseModel):
    id: str
    label: str
    kind: Literal["upi_app", "upi_id", "card", "netbanking", "wallet", "cod"]
    icon: str
    detail: str
    is_installed: bool = False
    popular: bool = False


class PaymentMethodsOut(BaseModel):
    upi_apps: list[PaymentOption]
    netbanking: list[PaymentOption]
    cards: list[PaymentOption]
    others: list[PaymentOption]
    note: str


class PaymentRequest(BaseModel):
    method_id: str
    upi_id: str | None = None
    bank_code: str | None = None


# --------------------------------------------------------------------------- #
# Admin
# --------------------------------------------------------------------------- #


class AdminStats(BaseModel):
    total_orders: int
    active_orders: int
    delivered_today: int
    total_revenue: float
    vendors_total: int
    vendors_online: int
    vendors_pending_kyc: int
    orders_by_status: dict[str, int]
    demand_by_service: dict[str, int]
    revenue_last_7_days: list[dict]
    total_litres_delivered: float


class KycDecision(BaseModel):
    decision: Literal["approve", "reject"]
    note: str = ""


class SimpleMessage(BaseModel):
    message: str
