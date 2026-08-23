"""Authentication primitives: password hashing, OTP generation, JWT handling.

Password hashing uses stdlib PBKDF2-HMAC-SHA256 rather than bcrypt/passlib.
That is a deliberate choice for this project: it needs no C compiler and no
third-party package, it is the algorithm NIST SP 800-63B explicitly sanctions,
and the work factor is tunable. A production deployment would more likely use
Argon2id via `argon2-cffi`.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import ROLE_ADMIN, ROLE_VENDOR, User

# OWASP-recommended minimum for PBKDF2-HMAC-SHA256 (2023 guidance).
PBKDF2_ITERATIONS = 600_000
SALT_BYTES = 16


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #


def hash_password(password: str) -> str:
    """Return `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>`."""
    salt = secrets.token_bytes(SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    """Constant-time verification. Returns False for any malformed hash."""
    if not stored:
        return False
    try:
        algorithm, iterations, salt_hex, digest_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        expected = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(expected.hex(), digest_hex)


# --------------------------------------------------------------------------- #
# OTP
# --------------------------------------------------------------------------- #


def generate_otp() -> str:
    """A cryptographically random 6-digit code (leading zeros preserved)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def otp_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(seconds=settings.otp_ttl_seconds)


def normalise_phone(phone: str) -> str:
    """Reduce a typed Indian mobile number to its 10 significant digits."""
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits


def is_valid_indian_mobile(phone: str) -> bool:
    digits = normalise_phone(phone)
    return len(digits) == 10 and digits[0] in "6789"


# --------------------------------------------------------------------------- #
# JWT
# --------------------------------------------------------------------------- #


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "phone": user.phone,
        "role": user.role,
        "name": user.name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# --------------------------------------------------------------------------- #
# FastAPI dependencies
# --------------------------------------------------------------------------- #

# auto_error=False so we can raise our own 401 with a clearer message, and so
# `current_user_optional` can legitimately return None.
bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated. Please log in.",
    headers={"WWW-Authenticate": "Bearer"},
)


def current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError:
        return None
    user = db.get(User, int(payload.get("sub", 0)))
    return user if user and user.is_active else None


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise CREDENTIALS_EXCEPTION
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except jwt.PyJWTError:
        raise CREDENTIALS_EXCEPTION from None

    user = db.get(User, int(payload.get("sub", 0)))
    if user is None or not user.is_active:
        raise CREDENTIALS_EXCEPTION
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required."
        )
    return user


def require_vendor(user: User = Depends(current_user)) -> User:
    if user.role not in (ROLE_VENDOR, ROLE_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Vendor access required."
        )
    return user
