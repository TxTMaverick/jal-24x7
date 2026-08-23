"""Event and party booking desk.

For a wedding, a function or an office event the customer does not want to add
cans to a cart. They want a person to talk to. This endpoint returns the
suppliers near them who staff an event desk, sized to their guest count.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Vendor
from ..schemas import EventContactOut, VendorOut
from ..services.geo import bounding_box, haversine_km

router = APIRouter(prefix="/events", tags=["events"])

# Planning rule of thumb used across Indian catering: roughly 1.5 litres of
# drinking water per guest for a half-day function, rounded up for summer.
LITRES_PER_GUEST = 1.5
SUMMER_UPLIFT = 1.25
CAMPER_LITRES = 100


@router.get("/contacts", response_model=list[EventContactOut])
def event_contacts(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    guests: int = Query(default=100, ge=10, le=5000),
    radius_km: float = Query(default=25, gt=0, le=200),
    is_summer: bool = True,
    db: Session = Depends(get_db),
):
    """Suppliers near the venue who take event bookings, with a sizing estimate."""
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)

    stmt = select(Vendor).where(
        Vendor.supports_events.is_(True),
        Vendor.is_verified.is_(True),
        Vendor.lat.between(min_lat, max_lat),
        Vendor.lng.between(min_lng, max_lng),
    )

    litres = int(guests * LITRES_PER_GUEST * (SUMMER_UPLIFT if is_summer else 1.0))
    campers = max(1, -(-litres // CAMPER_LITRES))  # ceiling division

    rows: list[EventContactOut] = []
    for vendor in db.scalars(stmt):
        distance = haversine_km(lat, lng, vendor.lat, vendor.lng)
        if distance > radius_km:
            continue
        if not (vendor.event_min_guests <= guests <= vendor.event_max_guests):
            continue

        # Chilled event campers run about Rs 5.80 per litre delivered.
        estimated = round(litres * 5.8, 2)

        rows.append(
            EventContactOut(
                vendor=VendorOut.model_validate(vendor),
                distance_km=round(distance, 2),
                contact_person=vendor.event_contact_name or vendor.name,
                contact_phone=vendor.phone,
                area=vendor.area or vendor.city,
                min_guests=vendor.event_min_guests,
                max_guests=vendor.event_max_guests,
                suggested_litres=litres,
                suggested_campers=campers,
                estimated_cost=estimated,
            )
        )

    rows.sort(key=lambda r: (r.distance_km, -r.vendor.rating))
    return rows


@router.get("/sizing")
def sizing_guide(
    guests: int = Query(default=100, ge=10, le=5000),
    hours: int = Query(default=4, ge=1, le=24),
    is_summer: bool = True,
):
    """Standalone calculator so a planner can size an order before contacting anyone."""
    base = guests * LITRES_PER_GUEST * (hours / 4)
    litres = int(base * (SUMMER_UPLIFT if is_summer else 1.0))

    return {
        "guests": guests,
        "hours": hours,
        "is_summer": is_summer,
        "total_litres": litres,
        "campers_100l": max(1, -(-litres // 100)),
        "cans_20l": max(1, -(-litres // 20)),
        "bottles_1l": litres,
        "note": (
            "Based on 1.5 litres per guest for a four-hour function, "
            "scaled for duration and increased by 25 percent in summer."
        ),
    }
