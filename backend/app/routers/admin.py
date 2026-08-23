"""Screen 11: admin dashboard -- analytics, vendor KYC, order oversight."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    KYC_APPROVED,
    KYC_PENDING,
    KYC_REJECTED,
    ContactMessage,
    Order,
    OrderItem,
    Subscription,
    User,
    Vendor,
)
from ..schemas import (
    AdminStats,
    KycDecision,
    OrderOut,
    OrderStatusUpdate,
    SimpleMessage,
    VendorOut,
)
from ..security import require_admin
from ..services.tracking import build_snapshot, manager, record_event

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats", response_model=AdminStats)
def dashboard_stats(db: Session = Depends(get_db)):
    """Everything the dashboard needs in one round trip."""
    now = datetime.now(timezone.utc)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    orders = db.scalars(select(Order).options(selectinload(Order.items))).all()

    status_counts = Counter(o.status for o in orders)
    active = sum(1 for o in orders if o.status not in ("delivered", "cancelled"))

    def _aware(dt: datetime) -> datetime:
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    delivered_today = sum(
        1 for o in orders if o.status == "delivered" and _aware(o.updated_at) >= start_of_today
    )
    revenue = sum(o.total for o in orders if o.payment_status == "paid")

    # Demand split across the three service types the synopsis chart shows.
    demand: Counter[str] = Counter()
    litres = 0.0
    for order in orders:
        for item in order.items:
            key = "tanker" if item.item_type == "tanker" else None
            if key is None:
                name = item.name.lower()
                key = "camper" if "camper" in name else "bottled"
            demand[key] += item.quantity
            if order.status == "delivered":
                litres += item.capacity_l * item.quantity

    # Revenue trend, oldest first, with zero-filled gaps so the chart is even.
    revenue_by_day: dict[str, float] = {}
    for offset in range(6, -1, -1):
        day = (now - timedelta(days=offset)).strftime("%Y-%m-%d")
        revenue_by_day[day] = 0.0
    for order in orders:
        if order.payment_status != "paid":
            continue
        day = _aware(order.created_at).strftime("%Y-%m-%d")
        if day in revenue_by_day:
            revenue_by_day[day] += order.total

    vendors = db.scalars(select(Vendor)).all()

    return AdminStats(
        total_orders=len(orders),
        active_orders=active,
        delivered_today=delivered_today,
        total_revenue=round(revenue, 2),
        vendors_total=len(vendors),
        vendors_online=sum(1 for v in vendors if v.is_online),
        vendors_pending_kyc=sum(1 for v in vendors if v.kyc_status == KYC_PENDING),
        orders_by_status=dict(status_counts),
        demand_by_service={
            "tanker": demand.get("tanker", 0),
            "bottled": demand.get("bottled", 0),
            "camper": demand.get("camper", 0),
        },
        revenue_last_7_days=[
            {"date": day, "revenue": round(value, 2)} for day, value in revenue_by_day.items()
        ],
        total_litres_delivered=round(litres, 2),
    )


@router.get("/orders", response_model=list[OrderOut])
def all_orders(
    db: Session = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
):
    stmt = select(Order).options(
        selectinload(Order.items), selectinload(Order.events), selectinload(Order.vendor)
    )
    if status_filter == "active":
        stmt = stmt.where(Order.status.notin_(["delivered", "cancelled"]))
    elif status_filter:
        stmt = stmt.where(Order.status == status_filter)
    return db.scalars(stmt.order_by(Order.created_at.desc()).limit(limit)).all()


@router.get("/vendors", response_model=list[VendorOut])
def all_vendors(db: Session = Depends(get_db), kyc_status: str | None = None):
    stmt = select(Vendor)
    if kyc_status:
        stmt = stmt.where(Vendor.kyc_status == kyc_status)
    return db.scalars(stmt.order_by(Vendor.created_at.desc())).all()


@router.post("/vendors/{vendor_id}/kyc", response_model=VendorOut)
def decide_kyc(vendor_id: int, payload: KycDecision, db: Session = Depends(get_db)):
    """Approve or reject a vendor's KYC. Approval is what makes them listable."""
    vendor = db.get(Vendor, vendor_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    if payload.decision == "approve":
        vendor.kyc_status = KYC_APPROVED
        vendor.is_verified = True
    else:
        vendor.kyc_status = KYC_REJECTED
        vendor.is_verified = False
        vendor.is_online = False

    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("/messages")
def contact_messages(db: Session = Depends(get_db), limit: int = Query(default=100, ge=1, le=500)):
    messages = db.scalars(
        select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(limit)
    ).all()
    return [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "subject": m.subject,
            "message": m.message,
            "is_resolved": m.is_resolved,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.get("/subscriptions")
def all_subscriptions(db: Session = Depends(get_db)):
    subs = db.scalars(select(Subscription).order_by(Subscription.created_at.desc())).all()
    return [
        {
            "id": s.id,
            "plan_type": s.plan_type,
            "frequency": s.frequency,
            "quantity": s.quantity,
            "contact_name": s.contact_name,
            "society_name": s.society_name,
            "units_count": s.units_count,
            "estimated_cycle_cost": s.estimated_cycle_cost,
            "status": s.status,
            "created_at": s.created_at,
        }
        for s in subs
    ]
