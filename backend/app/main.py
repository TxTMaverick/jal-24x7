"""JAL 24x7 FastAPI application entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive API docs (great for the viva -- it documents itself):
    http://localhost:8000/docs
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import Base, engine
from .middleware import (
    BodySizeLimitMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from .routers import (
    admin,
    auth,
    catalog,
    contact,
    drivers,
    events,
    integrations,
    orders,
    payments,
    subscriptions,
    vendor_panel,
    vendors,
)
from .seed import seed_if_empty
from .services.tracking import bind_loop, shutdown_simulations

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("jal24x7")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and load demo data. For a real deployment you would run
    # Alembic migrations here instead of create_all.
    Base.metadata.create_all(bind=engine)
    seed_if_empty()

    # Hand the tracking simulator a reference to this loop, so sync endpoints
    # running in the threadpool can still schedule background work onto it.
    bind_loop(asyncio.get_running_loop())

    logger.info("JAL 24x7 API ready  |  docs at /docs  |  demo_mode=%s", settings.demo_mode)
    yield
    await shutdown_simulations()
    logger.info("JAL 24x7 API shutting down")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Backend for JAL 24x7 -- an on-demand water delivery and booking platform.\n\n"
        "Business logic lives in `app/services`: vendor matching, pricing rules, "
        "and the live-tracking engine."
    ),
    lifespan=lifespan,
)

# Middleware runs bottom-up on the request, so the outermost listed here is
# the last to see the request. Order matters: reject oversized and abusive
# requests before any handler work happens.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    # Explicit allow-list, never "*". A wildcard with credentials enabled would
    # let any site on the internet make authenticated calls on a user's behalf.
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
    """Turn a stray ValueError into a clean 400 instead of a 500 stack trace."""
    return JSONResponse(status_code=400, content={"detail": str(exc)})


api = settings.api_v1_prefix
app.include_router(auth.router, prefix=api)
app.include_router(catalog.router, prefix=api)
app.include_router(vendors.router, prefix=api)
app.include_router(orders.router, prefix=api)
app.include_router(subscriptions.router, prefix=api)
app.include_router(contact.router, prefix=api)
app.include_router(admin.router, prefix=api)
app.include_router(vendor_panel.router, prefix=api)
app.include_router(drivers.router, prefix=api)
app.include_router(events.router, prefix=api)
app.include_router(payments.router, prefix=api)
app.include_router(integrations.router, prefix=api)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "status": "ok",
        "docs": "/docs",
        "api_prefix": api,
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "healthy", "demo_mode": settings.demo_mode}
