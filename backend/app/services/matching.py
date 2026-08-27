"""Vendor matching engine.

Given a delivery pin and what the customer wants, decide which supplier should
get the job. This is the algorithmic core of the platform and the part most
worth explaining in the viva, so the scoring is deliberately transparent:
every candidate carries a `reasons` list saying why it scored what it did.

Scoring model (weighted sum, all components normalised to 0..1)
---------------------------------------------------------------
  proximity   0.40   nearer is better, linear decay to the service radius
  rating      0.25   4.0 -> 0.0, 5.0 -> 1.0
  headroom    0.20   how much free delivery capacity the vendor has right now
  experience  0.10   log-scaled completed orders, saturating around 500
  price       0.05   cheaper is better, relative to the candidate pool

Hard filters run before scoring: a vendor that is unverified, offline, out of
range, or unable to serve the requested capacity is never a candidate at all.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import Vendor
from .geo import CIRCUITY_FACTOR, bounding_box, haversine_km

WEIGHTS = {
    "proximity": 0.40,
    "rating": 0.25,
    "headroom": 0.20,
    "experience": 0.10,
    "price": 0.05,
}

# Average tanker/van speed through Indian city traffic, km/h.
AVG_SPEED_KMPH = 22.0
# Fixed minutes for loading, paperwork and handover at each end.
HANDLING_MINUTES = 18


@dataclass
class VendorMatch:
    vendor: Vendor
    distance_km: float
    score: float
    eta_minutes: int
    reasons: list[str] = field(default_factory=list)
    breakdown: dict[str, float] = field(default_factory=dict)


def estimate_eta_minutes(distance_km: float, *, active_load: int = 0) -> int:
    """Travel time + handling + a queueing penalty for a busy vendor."""
    travel = (distance_km / AVG_SPEED_KMPH) * 60
    queue_penalty = active_load * 7
    return max(15, int(round(travel + HANDLING_MINUTES + queue_penalty)))


def _normalise_rating(rating: float) -> float:
    # Everything on the platform sits between 3.5 and 5.0, so stretch that
    # band across the full 0..1 range or the component barely discriminates.
    return max(0.0, min(1.0, (rating - 3.5) / 1.5))


def _normalise_experience(completed: int) -> float:
    # Log scale: the gap between 0 and 50 orders matters far more than the
    # gap between 400 and 450.
    return min(1.0, math.log1p(completed) / math.log1p(500))


def _normalise_headroom(vendor: Vendor) -> float:
    capacity = max(vendor.capacity_per_slot, 1)
    free = max(capacity - vendor.active_load, 0)
    return free / capacity


def candidate_vendors(
    db: Session,
    *,
    lat: float,
    lng: float,
    radius_km: float | None = None,
    required_capacity_l: int | None = None,
    needs_tanker: bool = False,
    verified_only: bool = True,
    include_offline: bool = False,
) -> list[tuple[Vendor, float]]:
    """Hard-filter stage. Returns (vendor, distance_km) pairs still in the running."""
    radius = radius_km if radius_km is not None else settings.service_radius_km
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius)

    stmt = select(Vendor).where(
        Vendor.lat.between(min_lat, max_lat),
        Vendor.lng.between(min_lng, max_lng),
    )
    if verified_only:
        stmt = stmt.where(Vendor.is_verified.is_(True))
    if not include_offline:
        stmt = stmt.where(Vendor.is_online.is_(True))
    if needs_tanker:
        stmt = stmt.where(Vendor.supports_tankers.is_(True))
    else:
        stmt = stmt.where(Vendor.supports_products.is_(True))
    if required_capacity_l is not None:
        stmt = stmt.where(
            Vendor.min_capacity_l <= required_capacity_l,
            Vendor.max_capacity_l >= required_capacity_l,
        )

    results: list[tuple[Vendor, float]] = []
    for vendor in db.scalars(stmt):
        # The bounding box is a square; the service area is a circle. Re-check.
        distance = haversine_km(lat, lng, vendor.lat, vendor.lng)
        if distance <= radius:
            results.append((vendor, distance))
    return results


def nearest_vendors(
    db: Session,
    *,
    lat: float,
    lng: float,
    limit: int = 12,
    required_capacity_l: int | None = None,
    needs_tanker: bool = False,
    verified_only: bool = True,
) -> list[tuple[Vendor, float]]:
    """Closest vendors with no distance limit at all.

    The radius filter is the right behaviour for dispatch, but it makes the
    marketplace look broken for anyone browsing from a city the network has
    not reached yet. This backs the "nothing in range" fallback: same hard
    filters on capability and verification, distance ordering only.
    """
    stmt = select(Vendor)
    if verified_only:
        stmt = stmt.where(Vendor.is_verified.is_(True))
    if needs_tanker:
        stmt = stmt.where(Vendor.supports_tankers.is_(True))
    else:
        stmt = stmt.where(Vendor.supports_products.is_(True))
    if required_capacity_l is not None:
        stmt = stmt.where(
            Vendor.min_capacity_l <= required_capacity_l,
            Vendor.max_capacity_l >= required_capacity_l,
        )

    scored = [
        (vendor, haversine_km(lat, lng, vendor.lat, vendor.lng))
        for vendor in db.scalars(stmt)
    ]
    scored.sort(key=lambda pair: pair[1])
    return scored[:limit]


def rank_vendors(
    candidates: list[tuple[Vendor, float]],
    *,
    radius_km: float | None = None,
) -> list[VendorMatch]:
    """Score and sort candidates best-first."""
    if not candidates:
        return []

    radius = radius_km if radius_km is not None else settings.service_radius_km
    prices = [v.price_per_trip for v, _ in candidates]
    cheapest, dearest = min(prices), max(prices)
    price_spread = dearest - cheapest

    matches: list[VendorMatch] = []
    for vendor, distance in candidates:
        proximity = max(0.0, 1.0 - (distance / radius))
        rating = _normalise_rating(vendor.rating)
        headroom = _normalise_headroom(vendor)
        experience = _normalise_experience(vendor.completed_orders)
        price = 1.0 if price_spread == 0 else 1.0 - ((vendor.price_per_trip - cheapest) / price_spread)

        breakdown = {
            "proximity": round(proximity, 3),
            "rating": round(rating, 3),
            "headroom": round(headroom, 3),
            "experience": round(experience, 3),
            "price": round(price, 3),
        }
        score = sum(WEIGHTS[k] * v for k, v in breakdown.items())

        reasons: list[str] = [f"{distance:.1f} km away"]
        if headroom >= 0.6:
            reasons.append("Has free delivery slots right now")
        elif headroom <= 0.2:
            reasons.append("Currently busy")
        if vendor.rating >= 4.6:
            reasons.append(f"Highly rated ({vendor.rating:.1f}/5)")
        if vendor.price_per_trip == cheapest and price_spread > 0:
            reasons.append("Lowest price nearby")
        if vendor.completed_orders >= 200:
            reasons.append(f"{vendor.completed_orders}+ orders completed")

        matches.append(
            VendorMatch(
                vendor=vendor,
                distance_km=round(distance, 2),
                score=round(score, 4),
                eta_minutes=estimate_eta_minutes(
                    distance * CIRCUITY_FACTOR,
                    active_load=vendor.active_load,
                ),
                reasons=reasons,
                breakdown=breakdown,
            )
        )

    matches.sort(key=lambda m: m.score, reverse=True)
    return matches


def find_best_vendor(
    db: Session,
    *,
    lat: float,
    lng: float,
    required_capacity_l: int | None = None,
    needs_tanker: bool = False,
) -> VendorMatch | None:
    """Auto-assignment used at checkout.

    Falls back through progressively looser constraints rather than failing
    outright: a customer in a thinly-served area should still get *someone*.
    """
    attempts = [
        dict(required_capacity_l=required_capacity_l, verified_only=True),
        dict(required_capacity_l=None, verified_only=True),
        dict(required_capacity_l=None, verified_only=True, radius_km=settings.service_radius_km * 2),
    ]
    for kwargs in attempts:
        candidates = candidate_vendors(
            db, lat=lat, lng=lng, needs_tanker=needs_tanker, **kwargs
        )
        ranked = rank_vendors(candidates, radius_km=kwargs.get("radius_km"))
        if ranked:
            return ranked[0]
    return None
