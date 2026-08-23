"""Order lifecycle: checkout, history, payment, live tracking.

Screens 6, 7, 8 and 9 all hang off this router.
"""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import SessionLocal, get_db
from ..models import Order, OrderItem, Product, User, Vendor
from ..schemas import CartLineIn, OrderCreate, OrderOut, TrackingOut
from ..security import current_user
from ..services.cart import quote_for
from ..services.geo import road_distance_km
from ..services.matching import estimate_eta_minutes, find_best_vendor
from ..services.tracking import build_snapshot, manager, record_event, start_simulation

router = APIRouter(prefix="/orders", tags=["orders"])

DEFAULT_ORIGIN = (22.7196, 75.8577)  # Rajwada, Indore


def _generate_order_code(db: Session) -> str:
    """Human-readable, non-sequential code. Non-sequential matters: a
    guessable JAL-1, JAL-2 scheme would let anyone enumerate other people's
    orders on the public tracking page."""
    for _ in range(10):
        code = f"JAL{secrets.randbelow(900000) + 100000}"
        if db.scalars(select(Order).where(Order.order_code == code)).first() is None:
            return code
    raise HTTPException(status_code=500, detail="Could not allocate an order code. Please retry.")


def _load_order(db: Session, order_id_or_code: str) -> Order | None:
    stmt = select(Order).options(
        selectinload(Order.items), selectinload(Order.events), selectinload(Order.vendor)
    )
    if order_id_or_code.isdigit():
        stmt = stmt.where(Order.id == int(order_id_or_code))
    else:
        stmt = stmt.where(Order.order_code == order_id_or_code.upper())
    return db.scalars(stmt).first()


# --------------------------------------------------------------------------- #
# Checkout
# --------------------------------------------------------------------------- #


@router.post("", response_model=OrderOut, status_code=201)
def create_order(
    payload: OrderCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Create an order. Prices are recomputed server-side from the DB."""
    distance_km = road_distance_km(*DEFAULT_ORIGIN, payload.address_lat, payload.address_lng)

    quote, inferred_type = quote_for(
        db,
        payload.lines,
        distance_km=distance_km,
        is_express=payload.is_express,
        is_society=payload.is_society,
    )
    if inferred_type != payload.order_type:
        raise HTTPException(
            status_code=400,
            detail=f"Cart contains {inferred_type} items but order_type is {payload.order_type}.",
        )

    needs_tanker = inferred_type == "tanker"
    required_capacity = int(max((line.capacity_l for line in quote.lines), default=0)) or None

    # Vendor selection: honour an explicit marketplace pick, else auto-match.
    vendor: Vendor | None = None
    vendor_distance = distance_km
    if payload.preferred_vendor_id:
        vendor = db.get(Vendor, payload.preferred_vendor_id)
        if vendor is None or not vendor.is_verified:
            raise HTTPException(status_code=404, detail="Selected vendor is unavailable.")
        vendor_distance = road_distance_km(
            vendor.lat, vendor.lng, payload.address_lat, payload.address_lng
        )
    else:
        match = find_best_vendor(
            db,
            lat=payload.address_lat,
            lng=payload.address_lng,
            required_capacity_l=required_capacity if needs_tanker else None,
            needs_tanker=needs_tanker,
        )
        if match:
            vendor = match.vendor
            vendor_distance = match.distance_km * 1.35

    eta = estimate_eta_minutes(vendor_distance, active_load=vendor.active_load if vendor else 0)
    if payload.is_express:
        eta = max(15, int(eta * 0.6))

    order = Order(
        order_code=_generate_order_code(db),
        user_id=user.id,
        vendor_id=vendor.id if vendor else None,
        order_type=inferred_type,
        status="pending",
        subtotal=quote.subtotal,
        discount=quote.discount,
        delivery_fee=round(quote.delivery_fee + quote.distance_surcharge, 2),
        tax=quote.tax,
        total=quote.total,
        contact_name=payload.contact_name,
        contact_phone=payload.contact_phone,
        address_line=payload.address_line,
        address_city=payload.address_city,
        address_pincode=payload.address_pincode,
        address_lat=payload.address_lat,
        address_lng=payload.address_lng,
        delivery_slot=payload.delivery_slot,
        scheduled_for=payload.scheduled_for,
        is_express=payload.is_express,
        notes=payload.notes,
        payment_method=payload.payment_method,
        payment_status="pending",
        eta_minutes=eta,
    )
    db.add(order)
    db.flush()  # assigns order.id without committing

    for line in quote.lines:
        db.add(
            OrderItem(
                order_id=order.id,
                item_type=line.item_type,
                product_id=line.product_id,
                tanker_tier_id=line.tanker_tier_id,
                name=line.name,
                unit_price=line.unit_price,
                quantity=line.quantity,
                line_total=line.line_total,
                capacity_l=line.capacity_l,
            )
        )
        # Reserve stock at order time so two customers cannot buy the last can.
        if line.product_id:
            product = db.get(Product, line.product_id)
            if product:
                product.stock = max(0, product.stock - line.quantity)

    record_event(db, order, "pending", "Order created. Awaiting payment.")
    order.status = "pending"

    db.commit()
    return _load_order(db, str(order.id))


@router.post("/{order_code}/pay", response_model=OrderOut)
def confirm_payment(
    order_code: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Razorpay *test mode* stand-in.

    A real integration would verify the gateway's HMAC signature here before
    trusting the payment. We generate a test reference, mark the order paid,
    and kick off the live-tracking simulation.
    """
    order = _load_order(db, order_code)
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.payment_status == "paid":
        raise HTTPException(status_code=409, detail="This order is already paid.")

    order.payment_status = "paid"
    order.payment_ref = f"pay_test_{secrets.token_hex(8)}"
    record_event(db, order, "confirmed", "Payment confirmed. Finding the best supplier near you.")

    if order.vendor_id:
        vendor = db.get(Vendor, order.vendor_id)
        if vendor:
            vendor.active_load += 1

    db.commit()

    # Drive the order through vendor_assigned -> out_for_delivery -> delivered.
    start_simulation(order.order_code)

    return _load_order(db, order_code)


# --------------------------------------------------------------------------- #
# History (Screen 9)
# --------------------------------------------------------------------------- #


@router.get("", response_model=list[OrderOut])
def my_orders(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
):
    stmt = (
        select(Order)
        .options(selectinload(Order.items), selectinload(Order.events), selectinload(Order.vendor))
        .where(Order.user_id == user.id)
    )
    if status_filter == "active":
        stmt = stmt.where(Order.status.notin_(["delivered", "cancelled"]))
    elif status_filter:
        stmt = stmt.where(Order.status == status_filter)

    return db.scalars(stmt.order_by(Order.created_at.desc()).limit(limit)).all()


@router.get("/{order_code}", response_model=OrderOut)
def get_order(
    order_code: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    order = _load_order(db, order_code)
    if order is None or (order.user_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


@router.post("/{order_code}/cancel", response_model=OrderOut)
def cancel_order(
    order_code: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    order = _load_order(db, order_code)
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.status in ("out_for_delivery", "delivered"):
        raise HTTPException(
            status_code=409, detail="This order has already left the depot and cannot be cancelled."
        )
    if order.status == "cancelled":
        raise HTTPException(status_code=409, detail="This order is already cancelled.")

    # Return reserved stock to the shelf.
    for item in order.items:
        if item.product_id:
            product = db.get(Product, item.product_id)
            if product:
                product.stock += item.quantity
    if order.vendor_id:
        vendor = db.get(Vendor, order.vendor_id)
        if vendor:
            vendor.active_load = max(0, vendor.active_load - 1)

    record_event(db, order, "cancelled", "Cancelled by customer.")
    db.commit()
    return _load_order(db, order_code)


@router.post("/{order_code}/reorder", response_model=OrderOut, status_code=201)
def reorder(
    order_code: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """One-tap repeat of a past order (Screen 9)."""
    previous = _load_order(db, order_code)
    if previous is None or previous.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")

    lines = [
        CartLineIn(
            item_type=item.item_type,
            product_id=item.product_id,
            tanker_tier_id=item.tanker_tier_id,
            quantity=item.quantity,
        )
        for item in previous.items
    ]
    if not lines:
        raise HTTPException(status_code=400, detail="That order has no items to repeat.")

    # Re-uses the normal creation path, so a repeat order is re-priced at
    # today's rates and re-matched to whichever vendor is best right now.
    return create_order(
        OrderCreate(
            lines=lines,
            order_type=previous.order_type,
            contact_name=previous.contact_name,
            contact_phone=previous.contact_phone,
            address_line=previous.address_line,
            address_city=previous.address_city,
            address_pincode=previous.address_pincode,
            address_lat=previous.address_lat,
            address_lng=previous.address_lng,
            delivery_slot=previous.delivery_slot,
            is_express=previous.is_express,
            payment_method=previous.payment_method,
        ),
        user=user,
        db=db,
    )


# --------------------------------------------------------------------------- #
# Tracking (Screen 8)
# --------------------------------------------------------------------------- #


@router.get("/{order_code}/tracking", response_model=TrackingOut)
def get_tracking(order_code: str, db: Session = Depends(get_db)):
    """Public tracking snapshot.

    Deliberately unauthenticated so a tracking link can be shared, which is why
    order codes are random rather than sequential.
    """
    order = _load_order(db, order_code)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    snapshot = build_snapshot(order)
    snapshot.pop("type", None)
    return TrackingOut(**snapshot)


@router.websocket("/{order_code}/ws")
async def tracking_socket(websocket: WebSocket, order_code: str):
    """Live tracking channel -- replaces Supabase Realtime with plain FastAPI."""
    code = order_code.upper()

    db = SessionLocal()
    try:
        exists = db.scalars(select(Order).where(Order.order_code == code)).first() is not None
    finally:
        db.close()

    if not exists:
        await websocket.close(code=4404, reason="Order not found")
        return

    await manager.connect(code, websocket)
    try:
        # Push the current state immediately so the UI never renders empty.
        db = SessionLocal()
        try:
            order = db.scalars(
                select(Order).options(selectinload(Order.events), selectinload(Order.vendor))
                .where(Order.order_code == code)
            ).first()
            if order:
                await websocket.send_json(build_snapshot(order))
        finally:
            db.close()

        # Hold the connection open; the simulator pushes updates.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(code, websocket)
