"""Screen 10: contact form + the govt. zone-wise water department directory.

The directory is one of the two features the synopsis calls out as a
differentiator, so it gets a real table, a zone lookup, and a nearest-office
resolver rather than being a hard-coded list in the frontend.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ContactMessage, WaterDepartment
from ..schemas import ContactMessageIn, SimpleMessage, WaterDepartmentOut
from ..services.geo import haversine_km

router = APIRouter(tags=["contact"])


@router.post("/contact", response_model=SimpleMessage, status_code=201)
def submit_contact(payload: ContactMessageIn, db: Session = Depends(get_db)):
    db.add(ContactMessage(**payload.model_dump()))
    db.commit()
    return SimpleMessage(
        message="Thanks for reaching out. Our team will get back to you within 24 hours."
    )


@router.get("/water-departments", response_model=list[WaterDepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    city: str | None = None,
    zone: str | None = None,
):
    stmt = select(WaterDepartment)
    if city:
        stmt = stmt.where(WaterDepartment.city == city)
    if zone:
        stmt = stmt.where(WaterDepartment.zone == zone)
    return db.scalars(stmt.order_by(WaterDepartment.zone)).all()


@router.get("/water-departments/nearest", response_model=WaterDepartmentOut | None)
def nearest_department(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
    db: Session = Depends(get_db),
):
    """Auto-detect the caller's zone office from their pin.

    Backs the 'Your Zone: Zone 4 - Indore' line in the synopsis mock-up.
    """
    departments = [d for d in db.scalars(select(WaterDepartment)) if d.lat and d.lng]
    if not departments:
        return None
    return min(departments, key=lambda d: haversine_km(lat, lng, d.lat, d.lng))
