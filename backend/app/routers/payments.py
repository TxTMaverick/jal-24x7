"""Payment options and the demo payment gateway.

What this is
------------
A faithful *simulation* of an Indian payment sheet: UPI apps, UPI ID, cards,
net banking and cash on delivery. It validates input the way a real gateway
would (VPA format, card Luhn check, bank code) and returns a signed-looking
reference, but it never contacts a bank and never moves money.

Going live would mean replacing `process_payment` with a Razorpay order create
plus a server-side signature verification. The rest of the app does not change.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Order, User, Vendor
from ..schemas import OrderOut, PaymentMethodsOut, PaymentOption
from ..security import current_user
from ..services.tracking import record_event, start_simulation

router = APIRouter(prefix="/payments", tags=["payments"])

VPA_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,32}$")

UPI_APPS = [
    ("gpay", "Google Pay", "\U0001f7e2", "Pay using your linked bank account", True),
    ("phonepe", "PhonePe", "\U0001f7e3", "UPI, wallet and cards in one app", True),
    ("paytm", "Paytm", "\U0001f535", "UPI and Paytm wallet balance", True),
    ("bhim", "BHIM UPI", "\U0001f1ee\U0001f1f3", "Government of India UPI app", False),
    ("amazonpay", "Amazon Pay", "\U0001f7e0", "Amazon Pay UPI and balance", False),
    ("cred", "CRED Pay", "⚫", "Pay and earn CRED coins", False),
]

BANKS = [
    ("sbi", "State Bank of India", "\U0001f3e6"),
    ("hdfc", "HDFC Bank", "\U0001f3e6"),
    ("icici", "ICICI Bank", "\U0001f3e6"),
    ("axis", "Axis Bank", "\U0001f3e6"),
    ("kotak", "Kotak Mahindra Bank", "\U0001f3e6"),
    ("pnb", "Punjab National Bank", "\U0001f3e6"),
    ("bob", "Bank of Baroda", "\U0001f3e6"),
    ("canara", "Canara Bank", "\U0001f3e6"),
]


class PayRequest(BaseModel):
    method_id: str = Field(min_length=2, max_length=40)
    upi_id: str | None = Field(default=None, max_length=80)
    bank_code: str | None = Field(default=None, max_length=20)
    card_number: str | None = Field(default=None, max_length=25)
    card_holder: str | None = Field(default=None, max_length=80)


class PayResult(BaseModel):
    success: bool
    payment_ref: str
    method_label: str
    amount: float
    paid_at: datetime
    signature: str
    order: OrderOut


def _luhn_ok(number: str) -> bool:
    """Standard card checksum. Test cards like 4111111111111111 pass."""
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 12:
        return False
    checksum = 0
    for index, digit in enumerate(reversed(digits)):
        if index % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        checksum += digit
    return checksum % 10 == 0


def _sign(order_code: str, ref: str, amount: float) -> str:
    """Mirrors how Razorpay signs a payment so verification logic is real.

    Razorpay computes HMAC-SHA256 over "<order_id>|<payment_id>" using the API
    secret. We do exactly the same with our JWT secret standing in.
    """
    payload = f"{order_code}|{ref}|{amount:.2f}".encode()
    return hmac.new(settings.jwt_secret.encode(), payload, hashlib.sha256).hexdigest()


@router.get("/methods", response_model=PaymentMethodsOut)
def payment_methods() -> PaymentMethodsOut:
    """The payment sheet the checkout screen renders."""
    return PaymentMethodsOut(
        upi_apps=[
            PaymentOption(
                id=f"upi_{code}", label=label, kind="upi_app", icon=icon,
                detail=detail, is_installed=popular, popular=popular,
            )
            for code, label, icon, detail, popular in UPI_APPS
        ],
        netbanking=[
            PaymentOption(
                id=f"nb_{code}", label=name, kind="netbanking", icon=icon,
                detail="Redirects to your bank's secure login",
            )
            for code, name, icon in BANKS
        ],
        cards=[
            PaymentOption(
                id="card_new", label="Credit or Debit Card", kind="card", icon="\U0001f4b3",
                detail="Visa, Mastercard, RuPay and American Express",
            )
        ],
        others=[
            PaymentOption(
                id="upi_id", label="Pay using UPI ID", kind="upi_id", icon="\U0001f4f1",
                detail="Enter any UPI ID, for example name@okhdfcbank",
            ),
            PaymentOption(
                id="cod", label="Cash on Delivery", kind="cod", icon="\U0001f4b5",
                detail="Pay the delivery partner when your water arrives",
            ),
        ],
        note=(
            "Test mode. No money is transferred and no bank is contacted. "
            "Card and UPI details are validated for format only and are never stored."
        ),
    )


def _label_for(method_id: str, upi_id: str | None, bank_code: str | None) -> str:
    for code, label, _icon, _detail, _popular in UPI_APPS:
        if method_id == f"upi_{code}":
            return label
    for code, name, _icon in BANKS:
        if method_id == f"nb_{code}" or bank_code == code:
            return f"Net Banking, {name}"
    if method_id == "upi_id":
        return f"UPI, {upi_id}"
    if method_id == "card_new":
        return "Credit or Debit Card"
    if method_id == "cod":
        return "Cash on Delivery"
    return method_id


@router.post("/{order_code}/pay", response_model=PayResult)
def process_payment(
    order_code: str,
    payload: PayRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Validate the chosen method, mark the order paid, start live tracking."""
    order = (
        db.query(Order).filter(Order.order_code == order_code.upper()).one_or_none()
    )
    if order is None or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found.")
    if order.payment_status == "paid":
        raise HTTPException(status_code=409, detail="This order has already been paid for.")

    method = payload.method_id
    known = (
        {f"upi_{c}" for c, *_ in UPI_APPS}
        | {f"nb_{c}" for c, *_ in BANKS}
        | {"upi_id", "card_new", "cod"}
    )
    if method not in known:
        raise HTTPException(status_code=400, detail="Unsupported payment method.")

    # Method-specific validation, exactly where a real gateway would do it.
    if method == "upi_id":
        if not payload.upi_id or not VPA_PATTERN.match(payload.upi_id.strip()):
            raise HTTPException(
                status_code=400,
                detail="Enter a valid UPI ID, for example yourname@okhdfcbank.",
            )
    elif method == "card_new":
        digits = re.sub(r"\D", "", payload.card_number or "")
        if not _luhn_ok(digits):
            raise HTTPException(
                status_code=400,
                detail="That card number is not valid. In test mode try 4111 1111 1111 1111.",
            )
        if not (payload.card_holder or "").strip():
            raise HTTPException(status_code=400, detail="Enter the name printed on the card.")

    paid_at = datetime.now(timezone.utc)
    ref = f"pay_{secrets.token_hex(10)}"
    signature = _sign(order.order_code, ref, order.total)

    if method == "cod":
        order.payment_status = "cod_pending"
        order.payment_method = "cod"
    else:
        order.payment_status = "paid"
        order.payment_method = method
    order.payment_ref = ref

    record_event(
        db, order, "confirmed",
        f"Payment confirmed via {_label_for(method, payload.upi_id, payload.bank_code)}."
        if method != "cod"
        else "Order confirmed. Payment will be collected on delivery.",
    )

    if order.vendor_id:
        vendor = db.get(Vendor, order.vendor_id)
        if vendor:
            vendor.active_load += 1

    db.commit()
    db.refresh(order)

    start_simulation(order.order_code)

    return PayResult(
        success=True,
        payment_ref=ref,
        method_label=_label_for(method, payload.upi_id, payload.bank_code),
        amount=order.total,
        paid_at=paid_at,
        signature=signature,
        order=OrderOut.model_validate(order),
    )
