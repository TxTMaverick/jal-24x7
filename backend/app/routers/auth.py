"""Auth endpoints: OTP login, password login, registration, profile.

OTP in demo mode
----------------
`POST /api/auth/otp/request` generates a real, random, expiring, single-use
code and stores it hashed-by-nothing (it is a 5-minute throwaway). When
`DEMO_MODE=true` the code is also returned in the response body and printed to
the server console, so an examiner can complete the flow without an SMS
gateway. Flip `DEMO_MODE=false` and drop in an MSG91/Twilio call at the marked
line to go live -- nothing else changes.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import ROLE_CUSTOMER, Address, OtpChallenge, User
from ..schemas import (
    AddressIn,
    AddressOut,
    OtpRequest,
    OtpResponse,
    OtpVerify,
    PasswordLogin,
    RegisterRequest,
    SimpleMessage,
    TokenResponse,
    UserOut,
)
from ..security import (
    create_access_token,
    current_user,
    generate_otp,
    hash_password,
    normalise_phone,
    otp_expiry,
    verify_password,
)

logger = logging.getLogger("jal24x7.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


def _send_sms(phone: str, code: str) -> None:
    """Delivery channel for the OTP.

    Production would call an SMS gateway here, e.g.:
        requests.post(MSG91_URL, json={"mobile": f"91{phone}", "otp": code})
    For the project demo we log it and return it in the response instead.
    """
    logger.info("OTP for +91%s is %s (demo mode: not sent over SMS)", phone, code)


@router.post("/otp/request", response_model=OtpResponse)
def request_otp(payload: OtpRequest, db: Session = Depends(get_db)) -> OtpResponse:
    # Invalidate any earlier un-consumed codes so only the newest one works.
    db.query(OtpChallenge).filter(
        OtpChallenge.phone == payload.phone, OtpChallenge.consumed.is_(False)
    ).update({"consumed": True})

    code = generate_otp()
    db.add(
        OtpChallenge(
            phone=payload.phone,
            code=code,
            name_hint=payload.name,
            expires_at=otp_expiry(),
        )
    )
    db.commit()

    _send_sms(payload.phone, code)

    return OtpResponse(
        message=f"OTP sent to +91 {payload.phone}",
        expires_in_seconds=settings.otp_ttl_seconds,
        demo_otp=code if settings.demo_mode else None,
    )


@router.post("/otp/verify", response_model=TokenResponse)
def verify_otp(payload: OtpVerify, db: Session = Depends(get_db)) -> TokenResponse:
    challenge = db.scalars(
        select(OtpChallenge)
        .where(OtpChallenge.phone == payload.phone, OtpChallenge.consumed.is_(False))
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    ).first()

    if challenge is None:
        raise HTTPException(status_code=400, detail="No active OTP. Please request a new one.")

    # SQLite can hand back naive datetimes even from a timezone-aware column.
    expires_at = challenge.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        challenge.consumed = True
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")

    if challenge.attempts >= settings.otp_max_attempts:
        challenge.consumed = True
        db.commit()
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new OTP.")

    if challenge.code != payload.code:
        challenge.attempts += 1
        db.commit()
        remaining = settings.otp_max_attempts - challenge.attempts
        raise HTTPException(status_code=400, detail=f"Incorrect OTP. {remaining} attempt(s) left.")

    challenge.consumed = True

    user = db.scalars(select(User).where(User.phone == payload.phone)).first()
    is_new = user is None
    if is_new:
        user = User(
            name=payload.name or challenge.name_hint or f"Guest {payload.phone[-4:]}",
            phone=payload.phone,
            role=ROLE_CUSTOMER,
        )
        db.add(user)
    elif payload.name and user.name.startswith("Guest "):
        user.name = payload.name

    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user), user=UserOut.model_validate(user), is_new_user=is_new
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.scalars(select(User).where(User.phone == payload.phone)).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this mobile number already exists.")
    if payload.email:
        if db.scalars(select(User).where(User.email == payload.email)).first():
            raise HTTPException(status_code=409, detail="An account with this email already exists.")

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        role=payload.role,
        password_hash=hash_password(payload.password) if payload.password else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user), user=UserOut.model_validate(user), is_new_user=True
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: PasswordLogin, db: Session = Depends(get_db)) -> TokenResponse:
    identifier = payload.identifier.strip()
    phone = normalise_phone(identifier)

    user = db.scalars(
        select(User).where(or_(User.email == identifier, User.phone == phone))
    ).first()

    # Same error for "no such user" and "wrong password" -- do not let an
    # attacker enumerate which accounts exist.
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been deactivated.")

    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


# --------------------------------------------------------------------------- #
# Saved addresses
# --------------------------------------------------------------------------- #


@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc(), Address.id.desc())
    ).all()


@router.post("/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    address = Address(user_id=user.id, **payload.model_dump())

    # First address is always the default; a new default demotes the old one.
    existing_count = db.query(Address).filter(Address.user_id == user.id).count()
    if existing_count == 0:
        address.is_default = True
    elif address.is_default:
        db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})

    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", response_model=SimpleMessage)
def delete_address(
    address_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    address = db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found.")
    db.delete(address)
    db.commit()
    return SimpleMessage(message="Address removed.")
