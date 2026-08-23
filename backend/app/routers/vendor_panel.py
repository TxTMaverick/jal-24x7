"""Screen 12: vendor panel -- assigned orders, status updates, own listing."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import ORDER_STATUS_FLOW, Order, User, Vendor
from ..schemas import OrderOut, OrderStatusUpdate, VendorOut
from ..security import require_vendor
from ..services.tracking import build_snapshot, manager, record_event

router = APIRouter(prefix="/vendor", tags=["vendor-panel"])


class VendorProfileUpdate(BaseModel):
    tagline: str | None = Field(default=None, max_length=200)
    price_per_trip: float | None = Field(default=None, gt=0)
    min_capacity_l: int | None = Field(default=None, ge=0)
    max_capacity_l: int | None = Field(default=None, ge=0)
    capacity_per_slot: int | None = Field(default=None, ge=1, le=100)
    is_online: bool | None = None
    service_zones: str | None = Field(default=None, max_length=120)
    water_source: str | None = Field(default=None, max_length=120)
    certifications: str | None = Field(default=None, max_length=200)


def _vendor_for(user: User, db: Session) -> Vendor:
    vendor = db.scalars(select(Vendor).where(Vendor.user_id == user.id)).first()
    if vendor is None:
        raise HTTPException(status_code=404, detail="No vendor profile linked to this account.")
    return vendor


@router.get("/me", response_model=VendorOut)
def my_vendor_profile(user: User = Depends(require_vendor), db: Session = Depends(get_db)):
    return _vendor_for(user, db)


@router.patch("/me", response_model=VendorOut)
def update_my_profile(
    payload: VendorProfileUpdate,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    vendor = _vendor_for(user, db)
    updates = payload.model_dump(exclude_none=True)

    lo = updates.get("min_capacity_l", vendor.min_capacity_l)
    hi = updates.get("max_capacity_l", vendor.max_capacity_l)
    if lo > hi:
        raise HTTPException(status_code=400, detail="Minimum capacity cannot exceed maximum capacity.")

    for field, value in updates.items():
        setattr(vendor, field, value)
    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("/orders", response_model=list[OrderOut])
def assigned_orders(
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
    active_only: bool = False,
):
    vendor = _vendor_for(user, db)
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.vendor))
        .where(Order.vendor_id == vendor.id)
    )
    if active_only:
        stmt = stmt.where(Order.status.notin_(["delivered", "cancelled"]))
    return db.scalars(stmt.order_by(Order.created_at.desc())).all()


@router.post("/orders/{order_code}/status", response_model=OrderOut)
async def update_order_status(
    order_code: str,
    payload: OrderStatusUpdate,
    user: User = Depends(require_vendor),
    db: Session = Depends(get_db),
):
    """Manual status advance from the vendor's side.

    This is the real-world counterpart of the tracking simulator: in production
    the vendor's driver taps these buttons and customers see it live.
    """
    vendor = _vendor_for(user, db)
    order = db.scalars(
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.vendor))
        .where(Order.order_code == order_code.upper())
    ).first()

    if order is None or order.vendor_id != vendor.id:
        raise HTTPException(status_code=404, detail="Order not found for this vendor.")

    allowed = [*ORDER_STATUS_FLOW, "cancelled"]
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(allowed)}")

    # Statuses only move forward. Going backwards would corrupt the audit trail.
    if payload.status in ORDER_STATUS_FLOW and order.status in ORDER_STATUS_FLOW:
        if ORDER_STATUS_FLOW.index(payload.status) <= ORDER_STATUS_FLOW.index(order.status):
            raise HTTPException(
                status_code=409,
                detail=f"Order is already at '{order.status}'; cannot move back to '{payload.status}'.",
            )

    record_event(db, order, payload.status, payload.note)

    if payload.status == "out_for_delivery" and order.courier_lat is None:
        order.courier_lat, order.courier_lng = vendor.lat, vendor.lng
    elif payload.status == "delivered":
        order.courier_lat, order.courier_lng = order.address_lat, order.address_lng
        order.eta_minutes = 0
        vendor.completed_orders += 1
        vendor.active_load = max(0, vendor.active_load - 1)
    elif payload.status == "cancelled":
        vendor.active_load = max(0, vendor.active_load - 1)

    db.commit()
    db.refresh(order)

    # Push straight to anyone watching the tracking page.
    await manager.broadcast(order.order_code, build_snapshot(order))
    return order
