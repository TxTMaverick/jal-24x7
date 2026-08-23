"""Cart resolution.

Security note: the client sends only *ids and quantities*. Every price is
looked up server-side from the database. A tampered request that claims a 20L
can costs Rs 1 is simply ignored -- this is the single most important rule in
any checkout flow, so it lives in one shared function used by both the quote
endpoint and order creation.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import Product, TankerTier
from .pricing import PricedLine, Quote, build_quote, tanker_trip_price


def resolve_lines(
    db: Session,
    raw_lines: list,
    *,
    distance_km: float = 0.0,
    is_society: bool = False,
) -> tuple[list[PricedLine], str]:
    """Turn client cart lines into server-priced lines.

    Returns (priced lines, inferred order_type). Raises 400/404 on bad input.
    """
    if not raw_lines:
        raise HTTPException(status_code=400, detail="Your cart is empty.")

    priced: list[PricedLine] = []
    has_tanker = False
    has_product = False

    for raw in raw_lines:
        if raw.item_type == "tanker":
            has_tanker = True
            if raw.tanker_tier_id is None:
                raise HTTPException(status_code=400, detail="tanker_tier_id is required for tanker lines.")
            tier = db.get(TankerTier, raw.tanker_tier_id)
            if tier is None or not tier.is_active:
                raise HTTPException(status_code=404, detail=f"Tanker tier {raw.tanker_tier_id} is unavailable.")

            unit_price, _ = tanker_trip_price(tier.base_price, distance_km, is_society=is_society)
            priced.append(
                PricedLine(
                    item_type="tanker",
                    reference_id=tier.id,
                    tanker_tier_id=tier.id,
                    name=f"{tier.capacity_l}L Water Tanker ({tier.segment})",
                    unit_price=unit_price,
                    quantity=raw.quantity,
                    line_total=round(unit_price * raw.quantity, 2),
                    capacity_l=float(tier.capacity_l),
                )
            )
        else:
            has_product = True
            if raw.product_id is None:
                raise HTTPException(status_code=400, detail="product_id is required for product lines.")
            product = db.get(Product, raw.product_id)
            if product is None or not product.is_active:
                raise HTTPException(status_code=404, detail=f"Product {raw.product_id} is unavailable.")
            if product.stock < raw.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=f"Only {product.stock} x {product.name} left in stock.",
                )

            priced.append(
                PricedLine(
                    item_type="product",
                    reference_id=product.id,
                    product_id=product.id,
                    name=product.name,
                    unit_price=product.price,
                    quantity=raw.quantity,
                    line_total=round(product.price * raw.quantity, 2),
                    capacity_l=product.total_litres,
                )
            )

    if has_tanker and has_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tankers are billed per trip and must be ordered separately from packaged water.",
        )

    return priced, ("tanker" if has_tanker else "products")


def quote_for(
    db: Session,
    raw_lines: list,
    *,
    distance_km: float = 0.0,
    is_express: bool = False,
    is_society: bool = False,
) -> tuple[Quote, str]:
    lines, order_type = resolve_lines(db, raw_lines, distance_km=distance_km, is_society=is_society)
    quote = build_quote(
        lines,
        distance_km=distance_km,
        is_express=is_express,
        order_type=order_type,
        is_society=is_society,
    )
    return quote, order_type
