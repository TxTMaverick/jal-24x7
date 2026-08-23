"""Pricing engine.

All money decisions live here rather than in the routers, so there is exactly
one place to read (and to test) when someone asks "why was I charged this?".

Rules implemented
-----------------
1. Per-unit products are priced quantity x unit price.
2. Tankers are billed *per trip*, with a distance surcharge beyond a free
   radius, because a tanker's dominant cost is the round trip, not the water.
3. Bulk slabs give a volume discount on large per-unit orders.
4. Delivery is free above a threshold; express delivery costs more.
5. GST is applied on (subtotal - discount + delivery), the way an Indian
   invoice actually computes it.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..config import settings

# Volume discount slabs for per-unit products: (min litres, discount rate).
# Evaluated top-down, first match wins.
BULK_SLABS: list[tuple[float, float]] = [
    (1000.0, 0.10),
    (500.0, 0.07),
    (200.0, 0.04),
]

# Tanker distance surcharge.
TANKER_FREE_RADIUS_KM = 8.0
TANKER_PER_KM_SURCHARGE = 12.0

# A society tanker contract is repeat business, so it is priced below spot rate.
SOCIETY_CONTRACT_DISCOUNT = 0.08

# Recurring camper subscriptions, by frequency.
SUBSCRIPTION_DISCOUNTS: dict[str, float] = {
    "daily": 0.12,
    "alternate": 0.08,
    "weekly": 0.05,
}


@dataclass
class PricedLine:
    """One resolved cart line, priced server-side."""

    item_type: str  # product | tanker
    reference_id: int
    name: str
    unit_price: float
    quantity: int
    line_total: float
    capacity_l: float
    product_id: int | None = None
    tanker_tier_id: int | None = None


@dataclass
class Quote:
    """A complete, itemised price breakdown for a cart."""

    lines: list[PricedLine] = field(default_factory=list)
    subtotal: float = 0.0
    discount: float = 0.0
    discount_label: str = ""
    delivery_fee: float = 0.0
    distance_surcharge: float = 0.0
    tax: float = 0.0
    total: float = 0.0
    total_litres: float = 0.0
    distance_km: float = 0.0

    def as_dict(self) -> dict:
        return {
            "subtotal": round(self.subtotal, 2),
            "discount": round(self.discount, 2),
            "discount_label": self.discount_label,
            "delivery_fee": round(self.delivery_fee, 2),
            "distance_surcharge": round(self.distance_surcharge, 2),
            "tax": round(self.tax, 2),
            "total": round(self.total, 2),
            "total_litres": round(self.total_litres, 2),
            "distance_km": round(self.distance_km, 2),
        }


def bulk_discount_rate(total_litres: float) -> tuple[float, str]:
    """Return (rate, human label) for the volume slab this order falls into."""
    for threshold, rate in BULK_SLABS:
        if total_litres >= threshold:
            return rate, f"Bulk discount ({int(rate * 100)}% over {int(threshold)}L)"
    return 0.0, ""


def tanker_trip_price(
    base_price: float, distance_km: float, *, is_society: bool = False
) -> tuple[float, float]:
    """Price a single tanker trip.

    Returns (billable trip price, distance surcharge) so the surcharge can be
    shown to the customer as its own line rather than hidden in the total.
    """
    surcharge = 0.0
    if distance_km > TANKER_FREE_RADIUS_KM:
        surcharge = (distance_km - TANKER_FREE_RADIUS_KM) * TANKER_PER_KM_SURCHARGE

    price = base_price
    if is_society:
        price *= 1 - SOCIETY_CONTRACT_DISCOUNT

    return round(price, 2), round(surcharge, 2)


def delivery_fee_for(subtotal: float, *, is_express: bool, order_type: str) -> float:
    """Delivery fee rules.

    Tankers never carry a separate delivery fee -- the trip *is* the delivery,
    and it is already priced into the per-trip rate plus distance surcharge.
    """
    if order_type == "tanker":
        return 0.0
    if is_express:
        return settings.express_delivery_fee
    if subtotal >= settings.free_delivery_threshold:
        return 0.0
    return settings.base_delivery_fee


def build_quote(
    lines: list[PricedLine],
    *,
    distance_km: float = 0.0,
    is_express: bool = False,
    order_type: str = "products",
    is_society: bool = False,
) -> Quote:
    """Turn priced lines into a full invoice breakdown."""
    quote = Quote(lines=lines, distance_km=distance_km)

    quote.subtotal = round(sum(line.line_total for line in lines), 2)
    quote.total_litres = round(
        sum(line.capacity_l * line.quantity for line in lines), 2
    )

    if order_type == "tanker":
        # Surcharge scales with the number of trips being booked.
        trips = sum(line.quantity for line in lines) or 1
        _, per_trip_surcharge = tanker_trip_price(0.0, distance_km, is_society=is_society)
        quote.distance_surcharge = round(per_trip_surcharge * trips, 2)
        if is_society:
            quote.discount = round(
                quote.subtotal * SOCIETY_CONTRACT_DISCOUNT / (1 - SOCIETY_CONTRACT_DISCOUNT),
                2,
            )
            quote.discount_label = (
                f"Society contract rate ({int(SOCIETY_CONTRACT_DISCOUNT * 100)}% off)"
            )
    else:
        rate, label = bulk_discount_rate(quote.total_litres)
        quote.discount = round(quote.subtotal * rate, 2)
        quote.discount_label = label

    quote.delivery_fee = delivery_fee_for(
        quote.subtotal, is_express=is_express, order_type=order_type
    )

    taxable = quote.subtotal - quote.discount + quote.delivery_fee + quote.distance_surcharge
    quote.tax = round(max(taxable, 0.0) * settings.gst_rate, 2)
    quote.total = round(max(taxable, 0.0) + quote.tax, 2)
    return quote


def subscription_cycle_cost(
    unit_price: float, quantity: int, frequency: str
) -> tuple[float, float]:
    """Estimated 30-day cost of a recurring plan.

    Returns (cycle cost after discount, discount rate applied).
    """
    deliveries_per_month = {"daily": 30, "alternate": 15, "weekly": 4}.get(frequency, 30)
    rate = SUBSCRIPTION_DISCOUNTS.get(frequency, 0.0)
    gross = unit_price * quantity * deliveries_per_month
    return round(gross * (1 - rate), 2), rate
