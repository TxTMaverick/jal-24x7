"""Security middleware.

Covers the realistic threats for a public booking site of this size:

  1. Security headers      clickjacking, MIME sniffing, referrer leakage,
                           and a Content-Security-Policy on API responses.
  2. Rate limiting         stops OTP brute-forcing and scripted order spam
                           from a single IP.
  3. Body size limit       rejects oversized payloads before they are parsed.
  4. Request ID            every response is traceable in the server log.

What is deliberately NOT here, and why:
  * TLS termination is the hosting platform's job (Render and Vercel both
    force HTTPS), so we set HSTS but do not try to redirect ourselves.
  * SQL injection is already prevented by SQLAlchemy's parameter binding.
  * Cross-site scripting is prevented by React escaping all interpolated text
    plus the sanitisation in `validators.py`. We never use dangerouslySetInnerHTML.
"""

from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from .config import settings

logger = logging.getLogger("jal24x7.security")

# Max bytes we will accept in a request body (1 MB is generous for JSON here).
MAX_BODY_BYTES = 1_048_576

# (requests, seconds) per client IP. Sensitive routes get a tighter budget.
DEFAULT_LIMIT = (240, 60)
ROUTE_LIMITS: list[tuple[str, tuple[int, int]]] = [
    ("/api/auth/otp/request", (5, 300)),   # 5 OTP sends per 5 minutes
    ("/api/auth/otp/verify", (10, 300)),   # 10 verify attempts per 5 minutes
    ("/api/auth/login", (10, 300)),
    ("/api/auth/register", (5, 600)),
    ("/api/orders", (30, 60)),
    ("/api/payments", (20, 60)),
    ("/api/contact", (5, 600)),
]

_hits: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    """Best-effort client IP, honouring one layer of reverse proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _limit_for(path: str) -> tuple[int, int]:
    for prefix, limit in ROUTE_LIMITS:
        if path.startswith(prefix):
            return limit
    return DEFAULT_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window-per-key limiter backed by an in-process deque.

    Adequate for a single-instance deployment. A multi-instance production
    setup would move the counters into Redis so they are shared.
    """

    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limit_enabled or request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        max_requests, window = _limit_for(path)
        key = f"{_client_ip(request)}:{path}"
        now = time.time()

        bucket = _hits[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()

        if len(bucket) >= max_requests:
            retry_after = int(window - (now - bucket[0])) + 1
            logger.warning("Rate limit hit for %s on %s", _client_ip(request), path)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": (
                        "Too many requests. Please wait "
                        f"{retry_after} second{'s' if retry_after != 1 else ''} and try again."
                    )
                },
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)

        # Opportunistic cleanup so the dict cannot grow without bound.
        if len(_hits) > 4096:
            for stale_key in [k for k, v in _hits.items() if not v or now - v[-1] > 3600]:
                _hits.pop(stale_key, None)

        return await call_next(request)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized bodies using the declared Content-Length."""

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body is too large."},
            )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach hardening headers and a request id to every response."""

    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        started = time.perf_counter()

        response = await call_next(request)

        elapsed_ms = (time.perf_counter() - started) * 1000

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = f"{elapsed_ms:.1f}ms"

        # Never let a browser guess a content type.
        response.headers["X-Content-Type-Options"] = "nosniff"
        # This API is never meant to be framed.
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(self), camera=(), microphone=(), payment=(), usb=()"
        )
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"
        # JSON API: nothing should ever execute or be embedded from here.
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        )
        response.headers["Cache-Control"] = "no-store"

        if not settings.demo_mode:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response
