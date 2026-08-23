"""Database models for JAL 24x7.

Design notes
------------
* Statuses / roles are stored as plain strings (with module-level constants)
  rather than SQL ENUMs, so the same schema works on SQLite and Postgres.
* Money is stored as Float for simplicity at project scale. A production build
  would use Numeric(10, 2) to avoid float rounding on currency.
* `Order` carries a denormalised copy of the delivery address. That is
  deliberate: an order is a historical record and must not change if the user
  later edits or deletes the saved address.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #

ROLE_CUSTOMER = "customer"
ROLE_VENDOR = "vendor"
ROLE_ADMIN = "admin"

# Order lifecycle, in the exact order the tracking stepper renders them.
ORDER_STATUS_FLOW = [
    "pending",
    "confirmed",
    "vendor_assigned",
    "out_for_delivery",
    "delivered",
]
ORDER_STATUS_CANCELLED = "cancelled"

CATEGORY_BOTTLE = "bottle"
CATEGORY_CAN = "can"
CATEGORY_CAMPER = "camper"

KYC_PENDING = "pending"
KYC_APPROVED = "approved"
KYC_REJECTED = "rejected"


# --------------------------------------------------------------------------- #
# Users & auth
# --------------------------------------------------------------------------- #


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default=ROLE_CUSTOMER, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    addresses: Mapped[list[Address]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    orders: Mapped[list[Order]] = relationship(back_populates="user")
    vendor_profile: Mapped[Vendor | None] = relationship(
        back_populates="user", uselist=False
    )


class OtpChallenge(Base):
    """A single send-OTP attempt. Consumed on successful verify."""

    __tablename__ = "otp_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code: Mapped[str] = mapped_column(String(6))
    name_hint: Mapped[str | None] = mapped_column(String(120), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(40), default="Home")
    line1: Mapped[str] = mapped_column(String(255))
    landmark: Mapped[str | None] = mapped_column(String(160), nullable=True)
    city: Mapped[str] = mapped_column(String(80), default="Indore")
    pincode: Mapped[str] = mapped_column(String(10), default="452001")
    zone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="addresses")


# --------------------------------------------------------------------------- #
# Catalogue
# --------------------------------------------------------------------------- #


class Product(Base):
    """Bottles, 20L cans and campers -- everything billed per unit."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    capacity_l: Mapped[float] = mapped_column(Float)
    pack_size: Mapped[int] = mapped_column(Integer, default=1)
    price: Mapped[float] = mapped_column(Float)
    mrp: Mapped[float | None] = mapped_column(Float, nullable=True)
    image: Mapped[str] = mapped_column(String(255), default="")  # emoji fallback
    image_url: Mapped[str] = mapped_column(String(255), default="")  # local photo
    delivery_speed: Mapped[str] = mapped_column(String(20), default="same_day")
    eta_minutes: Mapped[int] = mapped_column(Integer, default=90)
    stock: Mapped[int] = mapped_column(Integer, default=100)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    @property
    def total_litres(self) -> float:
        return self.capacity_l * self.pack_size


class TankerTier(Base):
    """Tankers are billed per trip, not per unit -- hence a separate table."""

    __tablename__ = "tanker_tiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    capacity_l: Mapped[int] = mapped_column(Integer)
    segment: Mapped[str] = mapped_column(String(20), index=True)  # individual | society
    base_price: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text, default="")
    eta_minutes: Mapped[int] = mapped_column(Integer, default=180)
    image_url: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, unique=True
    )
    name: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    tagline: Mapped[str] = mapped_column(String(200), default="")

    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    kyc_status: Mapped[str] = mapped_column(String(20), default=KYC_PENDING, index=True)
    kyc_document_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)

    rating: Mapped[float] = mapped_column(Float, default=4.5)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_orders: Mapped[int] = mapped_column(Integer, default=0)

    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    city: Mapped[str] = mapped_column(String(80), default="Indore")
    service_zones: Mapped[str] = mapped_column(String(120), default="")  # "3,4,7"

    min_capacity_l: Mapped[int] = mapped_column(Integer, default=1000)
    max_capacity_l: Mapped[int] = mapped_column(Integer, default=8000)
    price_per_trip: Mapped[float] = mapped_column(Float, default=800.0)
    supports_products: Mapped[bool] = mapped_column(Boolean, default=True)
    supports_tankers: Mapped[bool] = mapped_column(Boolean, default=True)
    # Event / party catering desk: not every supplier staffs one.
    supports_events: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    area: Mapped[str] = mapped_column(String(120), default="")
    event_contact_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    event_min_guests: Mapped[int] = mapped_column(Integer, default=50)
    event_max_guests: Mapped[int] = mapped_column(Integer, default=2000)

    is_online: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    active_load: Mapped[int] = mapped_column(Integer, default=0)
    capacity_per_slot: Mapped[int] = mapped_column(Integer, default=6)

    water_source: Mapped[str] = mapped_column(String(120), default="Borewell + RO")
    certifications: Mapped[str] = mapped_column(String(200), default="ISI marked")
    last_tested_on: Mapped[str | None] = mapped_column(String(40), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User | None] = relationship(back_populates="vendor_profile")
    orders: Mapped[list[Order]] = relationship(back_populates="vendor")
    drivers: Mapped[list[TankerDriver]] = relationship(back_populates="vendor")


class TankerDriver(Base):
    """A tanker driver, and the operator (vendor) they drive for.

    Customers booking a tanker want to know who is actually turning up, so the
    driver roster is first-class data rather than a detail hidden inside the
    vendor record.
    """

    __tablename__ = "tanker_drivers"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), index=True)

    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20))
    photo_url: Mapped[str] = mapped_column(String(255), default="")

    vehicle_number: Mapped[str] = mapped_column(String(20))
    vehicle_capacity_l: Mapped[int] = mapped_column(Integer, default=5000)
    licence_number: Mapped[str] = mapped_column(String(30), default="")
    experience_years: Mapped[int] = mapped_column(Integer, default=1)

    rating: Mapped[float] = mapped_column(Float, default=4.5)
    trips_completed: Mapped[int] = mapped_column(Integer, default=0)
    languages: Mapped[str] = mapped_column(String(120), default="Hindi, English")
    shift: Mapped[str] = mapped_column(String(40), default="Day (6 AM - 6 PM)")
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    vendor: Mapped[Vendor] = relationship(back_populates="drivers")


# --------------------------------------------------------------------------- #
# Orders
# --------------------------------------------------------------------------- #


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    vendor_id: Mapped[int | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True, index=True
    )

    order_type: Mapped[str] = mapped_column(String(20), default="products")
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    delivery_fee: Mapped[float] = mapped_column(Float, default=0.0)
    tax: Mapped[float] = mapped_column(Float, default=0.0)
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    # Denormalised delivery snapshot -- see module docstring.
    contact_name: Mapped[str] = mapped_column(String(120))
    contact_phone: Mapped[str] = mapped_column(String(20))
    address_line: Mapped[str] = mapped_column(String(255))
    address_city: Mapped[str] = mapped_column(String(80), default="Indore")
    address_pincode: Mapped[str] = mapped_column(String(10), default="452001")
    address_lat: Mapped[float] = mapped_column(Float)
    address_lng: Mapped[float] = mapped_column(Float)

    delivery_slot: Mapped[str | None] = mapped_column(String(60), nullable=True)
    scheduled_for: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_express: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    payment_method: Mapped[str] = mapped_column(String(30), default="razorpay_test")
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")
    payment_ref: Mapped[str | None] = mapped_column(String(60), nullable=True)

    driver_id: Mapped[int | None] = mapped_column(
        ForeignKey("tanker_drivers.id"), nullable=True
    )
    eta_minutes: Mapped[int] = mapped_column(Integer, default=60)
    courier_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    courier_lng: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: Mapped[User] = relationship(back_populates="orders")
    vendor: Mapped[Vendor | None] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    events: Mapped[list[OrderEvent]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderEvent.created_at",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )

    item_type: Mapped[str] = mapped_column(String(20), default="product")
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )
    tanker_tier_id: Mapped[int | None] = mapped_column(
        ForeignKey("tanker_tiers.id"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(160))
    unit_price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    line_total: Mapped[float] = mapped_column(Float)
    capacity_l: Mapped[float] = mapped_column(Float, default=0.0)

    order: Mapped[Order] = relationship(back_populates="items")


class OrderEvent(Base):
    """Append-only audit trail -- powers the tracking stepper and admin view."""

    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(30))
    note: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    order: Mapped[Order] = relationship(back_populates="events")


# --------------------------------------------------------------------------- #
# Subscriptions (Screen 5)
# --------------------------------------------------------------------------- #


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    plan_type: Mapped[str] = mapped_column(String(30), index=True)

    frequency: Mapped[str] = mapped_column(String(20), default="daily")
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id"), nullable=True
    )
    tanker_tier_id: Mapped[int | None] = mapped_column(
        ForeignKey("tanker_tiers.id"), nullable=True
    )

    contact_name: Mapped[str] = mapped_column(String(120))
    contact_phone: Mapped[str] = mapped_column(String(20))
    address_line: Mapped[str] = mapped_column(String(255))
    preferred_window: Mapped[str] = mapped_column(String(40), default="07:00-09:00")
    start_date: Mapped[str] = mapped_column(String(20))

    # Society-only fields
    society_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    units_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    estimated_cycle_cost: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# --------------------------------------------------------------------------- #
# Contact & govt directory (Screen 10)
# --------------------------------------------------------------------------- #


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160))
    subject: Mapped[str] = mapped_column(String(160), default="General enquiry")
    message: Mapped[str] = mapped_column(Text)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WaterDepartment(Base):
    """Govt. zone-wise directory -- a key differentiator from the synopsis."""

    __tablename__ = "water_departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    zone: Mapped[str] = mapped_column(String(40), index=True)
    city: Mapped[str] = mapped_column(String(80), default="Indore", index=True)
    office_name: Mapped[str] = mapped_column(String(160))
    address: Mapped[str] = mapped_column(String(255), default="")
    helpline: Mapped[str] = mapped_column(String(40))
    tanker_request_line: Mapped[str] = mapped_column(String(40), default="1916")
    billing_line: Mapped[str | None] = mapped_column(String(40), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
