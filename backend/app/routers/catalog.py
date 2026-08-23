"""Catalogue endpoints: products (Screen 2) and tanker tiers (Screen 3)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product, TankerTier
from ..schemas import ProductOut, QuoteOut, QuoteRequest, TankerTierOut
from ..services.cart import quote_for
from ..services.geo import road_distance_km

router = APIRouter(tags=["catalogue"])

# Our notional city-centre depot, used when the customer has not dropped a pin
# yet but we still want to show a realistic distance-based tanker price.
DEFAULT_ORIGIN = (22.7196, 75.8577)  # Rajwada, Indore


@router.get("/products", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    category: Literal["bottle", "can", "camper"] | None = None,
    delivery_speed: Literal["instant", "same_day", "scheduled"] | None = None,
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    min_capacity: float | None = Query(default=None, ge=0),
    sort: Literal["price_asc", "price_desc", "capacity_asc", "capacity_desc", "fastest"] = "price_asc",
    search: str | None = None,
):
    """Filterable / sortable catalogue -- backs the filter bar on Screen 2."""
    stmt = select(Product).where(Product.is_active.is_(True))

    if category:
        stmt = stmt.where(Product.category == category)
    if delivery_speed:
        stmt = stmt.where(Product.delivery_speed == delivery_speed)
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if min_capacity is not None:
        stmt = stmt.where(Product.capacity_l >= min_capacity)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(Product.name.ilike(pattern) | Product.description.ilike(pattern))

    order_by = {
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "capacity_asc": Product.capacity_l.asc(),
        "capacity_desc": Product.capacity_l.desc(),
        "fastest": Product.eta_minutes.asc(),
    }[sort]

    return db.scalars(stmt.order_by(order_by)).all()


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found.")
    return product


@router.get("/tankers", response_model=list[TankerTierOut])
def list_tankers(
    db: Session = Depends(get_db),
    segment: Literal["individual", "society"] | None = None,
):
    stmt = select(TankerTier).where(TankerTier.is_active.is_(True))
    if segment:
        stmt = stmt.where(TankerTier.segment == segment)
    return db.scalars(stmt.order_by(TankerTier.capacity_l.asc())).all()


@router.post("/quote", response_model=QuoteOut)
def get_quote(payload: QuoteRequest, db: Session = Depends(get_db)):
    """Price a cart without placing an order.

    The cart page calls this on every quantity change, so the customer always
    sees the same number the server will actually charge.
    """
    distance_km = 0.0
    if payload.lat is not None and payload.lng is not None:
        distance_km = road_distance_km(*DEFAULT_ORIGIN, payload.lat, payload.lng)

    quote, _ = quote_for(
        db,
        payload.lines,
        distance_km=distance_km,
        is_express=payload.is_express,
        is_society=payload.is_society,
    )

    return QuoteOut(
        lines=[
            {
                "item_type": line.item_type,
                "reference_id": line.reference_id,
                "name": line.name,
                "unit_price": line.unit_price,
                "quantity": line.quantity,
                "line_total": line.line_total,
                "capacity_l": line.capacity_l,
            }
            for line in quote.lines
        ],
        **quote.as_dict(),
    )
