"""Recurring plans (Screen 5): daily campers and society tanker contracts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product, Subscription, TankerTier, User
from ..schemas import SimpleMessage, SubscriptionCreate, SubscriptionOut
from ..security import current_user
from ..services.pricing import subscription_cycle_cost

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.post("", response_model=SubscriptionOut, status_code=201)
def create_subscription(
    payload: SubscriptionCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Start a recurring plan and quote its 30-day cost."""
    if payload.plan_type == "camper":
        if payload.product_id is None:
            raise HTTPException(status_code=400, detail="Choose a camper product for this plan.")
        product = db.get(Product, payload.product_id)
        if product is None or not product.is_active:
            raise HTTPException(status_code=404, detail="That product is unavailable.")
        unit_price = product.price
    else:
        if payload.tanker_tier_id is None:
            raise HTTPException(status_code=400, detail="Choose a tanker capacity for this contract.")
        if not payload.society_name:
            raise HTTPException(status_code=400, detail="Society name is required.")
        tier = db.get(TankerTier, payload.tanker_tier_id)
        if tier is None or not tier.is_active:
            raise HTTPException(status_code=404, detail="That tanker capacity is unavailable.")
        unit_price = tier.base_price

    cycle_cost, _ = subscription_cycle_cost(unit_price, payload.quantity, payload.frequency)

    subscription = Subscription(
        user_id=user.id,
        estimated_cycle_cost=cycle_cost,
        **payload.model_dump(),
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


@router.get("", response_model=list[SubscriptionOut])
def my_subscriptions(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
    ).all()


@router.post("/{subscription_id}/pause", response_model=SubscriptionOut)
def pause_subscription(
    subscription_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    subscription = db.get(Subscription, subscription_id)
    if subscription is None or subscription.user_id != user.id:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    subscription.status = "paused" if subscription.status == "active" else "active"
    db.commit()
    db.refresh(subscription)
    return subscription


@router.delete("/{subscription_id}", response_model=SimpleMessage)
def cancel_subscription(
    subscription_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    subscription = db.get(Subscription, subscription_id)
    if subscription is None or subscription.user_id != user.id:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    subscription.status = "cancelled"
    db.commit()
    return SimpleMessage(message="Subscription cancelled.")


@router.post("/estimate")
def estimate_plan(
    plan_type: str,
    frequency: str,
    quantity: int,
    product_id: int | None = None,
    tanker_tier_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Live cost preview while the customer fills in the subscription form."""
    if plan_type == "camper":
        product = db.get(Product, product_id) if product_id else None
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found.")
        unit_price = product.price
    else:
        tier = db.get(TankerTier, tanker_tier_id) if tanker_tier_id else None
        if tier is None:
            raise HTTPException(status_code=404, detail="Tanker tier not found.")
        unit_price = tier.base_price

    cycle_cost, rate = subscription_cycle_cost(unit_price, quantity, frequency)
    deliveries = {"daily": 30, "alternate": 15, "weekly": 4}.get(frequency, 30)
    return {
        "unit_price": unit_price,
        "quantity": quantity,
        "deliveries_per_month": deliveries,
        "gross_cost": round(unit_price * quantity * deliveries, 2),
        "discount_rate": rate,
        "estimated_cycle_cost": cycle_cost,
        "savings": round(unit_price * quantity * deliveries - cycle_cost, 2),
    }
