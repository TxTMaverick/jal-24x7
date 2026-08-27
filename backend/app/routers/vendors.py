"""Supplier marketplace (Screen 4) -- location-based vendor discovery."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Vendor
from ..schemas import VendorMatchOut, VendorOut
from ..services.matching import candidate_vendors, nearest_vendors, rank_vendors

router = APIRouter(prefix="/vendors", tags=["marketplace"])


@router.get("/nearby", response_model=list[VendorMatchOut])
def nearby_vendors(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    radius_km: float = Query(default=None, gt=0, le=200),
    verified_only: bool = True,
    needs_tanker: bool = False,
    capacity_l: int | None = Query(default=None, ge=0),
    sort: Literal["best", "nearest", "price", "rating"] = "best",
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Ranked list of suppliers around a pin.

    `sort=best` uses the full weighted matching score; the other modes expose
    the individual filters the marketplace UI offers.
    """
    radius = radius_km or settings.service_radius_km
    candidates = candidate_vendors(
        db,
        lat=lat,
        lng=lng,
        radius_km=radius,
        required_capacity_l=capacity_l,
        needs_tanker=needs_tanker,
        verified_only=verified_only,
    )
    matches = rank_vendors(candidates, radius_km=radius)

    # Nothing inside the radius: fall back to the nearest suppliers anywhere on
    # the network rather than returning an empty marketplace. They are ranked
    # against their own spread so the ordering still means something, and each
    # one is flagged so the UI can say plainly that it is outside the radius.
    fallback = False
    if not matches:
        widened = nearest_vendors(
            db,
            lat=lat,
            lng=lng,
            limit=limit,
            required_capacity_l=capacity_l,
            needs_tanker=needs_tanker,
            verified_only=verified_only,
        )
        if widened:
            fallback = True
            furthest = max(distance for _, distance in widened)
            matches = rank_vendors(widened, radius_km=max(furthest, radius))
            for match in matches:
                match.reasons.insert(0, f"Nearest supplier, {match.distance_km:.0f} km away")

    if sort == "nearest":
        matches.sort(key=lambda m: m.distance_km)
    elif sort == "price":
        matches.sort(key=lambda m: m.vendor.price_per_trip)
    elif sort == "rating":
        matches.sort(key=lambda m: (-m.vendor.rating, m.distance_km))

    return [
        VendorMatchOut(
            vendor=VendorOut.model_validate(m.vendor),
            distance_km=m.distance_km,
            score=m.score,
            eta_minutes=m.eta_minutes,
            reasons=m.reasons,
            breakdown=m.breakdown,
            out_of_range=fallback,
        )
        for m in matches[:limit]
    ]


@router.get("", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    verified_only: bool = True,
    city: str | None = None,
):
    stmt = select(Vendor)
    if verified_only:
        stmt = stmt.where(Vendor.is_verified.is_(True))
    if city:
        stmt = stmt.where(Vendor.city == city)
    return db.scalars(stmt.order_by(Vendor.rating.desc())).all()


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found.")
    return vendor
