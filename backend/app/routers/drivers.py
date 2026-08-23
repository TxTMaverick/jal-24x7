"""Tanker driver roster.

Booking a tanker is different from ordering a can: a vehicle and a person turn
up at your gate. Customers consistently ask "who is coming?", so the roster,
including which operator each driver works under, is exposed as real data.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import TankerDriver, Vendor
from ..schemas import DriverWithOperator, TankerDriverOut
from ..services.geo import haversine_km

router = APIRouter(prefix="/drivers", tags=["tanker-drivers"])


@router.get("", response_model=list[DriverWithOperator])
def list_drivers(
    db: Session = Depends(get_db),
    capacity_l: int | None = Query(default=None, ge=0, description="Minimum vehicle capacity"),
    available_only: bool = True,
    verified_operators_only: bool = True,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    vendor_id: int | None = None,
    limit: int = Query(default=40, ge=1, le=200),
):
    """Drivers, each paired with the operator they drive for.

    Pass lat/lng to also get the distance from the customer to that driver's
    depot, and to sort nearest-first.
    """
    stmt = select(TankerDriver).options(selectinload(TankerDriver.vendor))

    if available_only:
        stmt = stmt.where(TankerDriver.is_available.is_(True))
    if capacity_l:
        stmt = stmt.where(TankerDriver.vehicle_capacity_l >= capacity_l)
    if vendor_id:
        stmt = stmt.where(TankerDriver.vendor_id == vendor_id)

    rows: list[DriverWithOperator] = []
    for driver in db.scalars(stmt):
        vendor = driver.vendor
        if vendor is None:
            continue
        if verified_operators_only and not vendor.is_verified:
            continue

        distance = None
        if lat is not None and lng is not None:
            distance = round(haversine_km(lat, lng, vendor.lat, vendor.lng), 2)

        rows.append(
            DriverWithOperator(
                driver=TankerDriverOut.model_validate(driver),
                operator_name=vendor.name,
                operator_phone=vendor.phone,
                operator_verified=vendor.is_verified,
                operator_rating=vendor.rating,
                distance_km=distance,
            )
        )

    if lat is not None and lng is not None:
        rows.sort(key=lambda r: (r.distance_km if r.distance_km is not None else 1e9))
    else:
        rows.sort(key=lambda r: -r.driver.rating)

    return rows[:limit]


@router.get("/{driver_id}", response_model=DriverWithOperator)
def get_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = db.get(TankerDriver, driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found.")
    vendor = db.get(Vendor, driver.vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Operator not found for this driver.")

    return DriverWithOperator(
        driver=TankerDriverOut.model_validate(driver),
        operator_name=vendor.name,
        operator_phone=vendor.phone,
        operator_verified=vendor.is_verified,
        operator_rating=vendor.rating,
    )
