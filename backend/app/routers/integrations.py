"""Third-party API integrations, proxied through the backend.

Three free, key-less public APIs are wired in:

  1. Open-Meteo            weather at the delivery pin  -> demand guidance
  2. Nominatim (OSM)       reverse geocoding            -> "drop pin, get address"
  3. api.postalpincode.in  Indian PIN code lookup       -> auto-fill city and area

They are proxied rather than called from the browser for three reasons:
  * Nominatim's usage policy requires an identifying User-Agent, which a
    browser will not let us set.
  * It keeps CORS out of the picture entirely.
  * We can cache responses, which the same policy asks us to do.

Every call fails soft: if an upstream is slow or down, the endpoint returns a
usable fallback instead of breaking the checkout screen.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Query

logger = logging.getLogger("jal24x7.integrations")
router = APIRouter(prefix="/integrations", tags=["integrations"])

USER_AGENT = "JAL24x7/1.0 (MCA minor project; contact: support@jal24x7.example)"
TIMEOUT = httpx.Timeout(6.0, connect=4.0)

# Very small in-process TTL cache. Enough to respect upstream rate limits
# during a demo without pulling in Redis.
_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, ttl: float) -> Any | None:
    hit = _cache.get(key)
    if hit and (time.time() - hit[0]) < ttl:
        return hit[1]
    return None


def _store(key: str, value: Any) -> Any:
    _cache[key] = (time.time(), value)
    return value


# --------------------------------------------------------------------------- #
# 1. Weather -> water demand guidance
# --------------------------------------------------------------------------- #

WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle",
    55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers",
    81: "Heavy showers", 82: "Violent showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Severe thunderstorm",
}


def _demand_advice(temp: float | None, humidity: float | None) -> tuple[str, str, float]:
    """Translate weather into a plain-language ordering hint.

    Returns (level, message, suggested multiplier on a normal day's order).
    """
    if temp is None:
        return "normal", "Order as usual today.", 1.0
    if temp >= 42:
        return ("extreme",
                "Extreme heat. Drinking water demand peaks today, and tankers book out early.",
                1.6)
    if temp >= 38:
        return ("high",
                "Very hot today. Households typically order about 40 percent more water.",
                1.4)
    if temp >= 33:
        return ("elevated",
                "Warm today. Consider keeping one extra can in reserve.",
                1.2)
    if humidity is not None and humidity < 25:
        return ("elevated",
                "Very dry air today. Hydration needs go up even without high heat.",
                1.15)
    return "normal", "Comfortable conditions. Order as usual.", 1.0


@router.get("/weather")
async def weather(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
):
    """Current conditions at the delivery pin, plus a demand hint."""
    key = f"weather:{lat:.2f},{lng:.2f}"
    if (hit := _cached(key, ttl=600)) is not None:
        return hit

    fallback = {
        "available": False,
        "temperature_c": None,
        "humidity": None,
        "condition": "Weather unavailable",
        "demand_level": "normal",
        "advice": "Order as usual today.",
        "suggested_multiplier": 1.0,
        "source": "Open-Meteo",
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lng,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,apparent_temperature",
                    "daily": "temperature_2m_max",
                    "forecast_days": 1,
                    "timezone": "Asia/Kolkata",
                },
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Open-Meteo unavailable: %s", exc)
        return fallback

    current = data.get("current") or {}
    temp = current.get("temperature_2m")
    feels = current.get("apparent_temperature")
    humidity = current.get("relative_humidity_2m")
    code = current.get("weather_code")
    daily_max = ((data.get("daily") or {}).get("temperature_2m_max") or [None])[0]

    level, advice, multiplier = _demand_advice(daily_max if daily_max is not None else temp, humidity)

    return _store(key, {
        "available": True,
        "temperature_c": temp,
        "feels_like_c": feels,
        "max_today_c": daily_max,
        "humidity": humidity,
        "condition": WEATHER_CODES.get(code, "Current conditions"),
        "demand_level": level,
        "advice": advice,
        "suggested_multiplier": multiplier,
        "source": "Open-Meteo",
    })


# --------------------------------------------------------------------------- #
# 2. Reverse geocoding -> readable address from a dropped pin
# --------------------------------------------------------------------------- #


@router.get("/reverse-geocode")
async def reverse_geocode(
    lat: float = Query(ge=-90, le=90),
    lng: float = Query(ge=-180, le=180),
):
    """Turn a map pin into a street address the customer can confirm."""
    key = f"revgeo:{lat:.5f},{lng:.5f}"
    if (hit := _cached(key, ttl=86400)) is not None:
        return hit

    empty = {
        "available": False, "display_name": "", "address_line": "",
        "area": "", "city": "", "state": "", "pincode": "",
        "source": "OpenStreetMap Nominatim",
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "zoom": 18, "addressdetails": 1},
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Nominatim unavailable: %s", exc)
        return empty

    addr = data.get("address") or {}
    parts = [
        addr.get("house_number"),
        addr.get("road") or addr.get("pedestrian"),
        addr.get("neighbourhood") or addr.get("suburb"),
    ]
    area = addr.get("suburb") or addr.get("neighbourhood") or addr.get("city_district") or ""
    city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county") or ""

    return _store(key, {
        "available": True,
        "display_name": data.get("display_name", ""),
        "address_line": ", ".join(p for p in parts if p),
        "area": area,
        "city": city,
        "state": addr.get("state", ""),
        "pincode": addr.get("postcode", ""),
        "source": "OpenStreetMap Nominatim",
    })


# --------------------------------------------------------------------------- #
# 3. PIN code lookup -> auto-fill city, district and localities
# --------------------------------------------------------------------------- #


@router.get("/pincode/{pincode}")
async def pincode_lookup(pincode: str):
    """Resolve an Indian PIN code to its district, state and localities."""
    pincode = pincode.strip()
    if not (pincode.isdigit() and len(pincode) == 6):
        return {"available": False, "detail": "Enter a valid 6-digit PIN code."}

    key = f"pin:{pincode}"
    if (hit := _cached(key, ttl=604800)) is not None:
        return hit

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(f"https://api.postalpincode.in/pincode/{pincode}")
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("PIN code API unavailable: %s", exc)
        return {"available": False, "detail": "PIN code service is unavailable right now."}

    first = (data or [{}])[0]
    if first.get("Status") != "Success" or not first.get("PostOffice"):
        return _store(key, {"available": False, "detail": f"No records found for PIN {pincode}."})

    offices = first["PostOffice"]
    head = offices[0]

    return _store(key, {
        "available": True,
        "pincode": pincode,
        "city": head.get("District", ""),
        "district": head.get("District", ""),
        "state": head.get("State", ""),
        "region": head.get("Region", ""),
        "localities": [o.get("Name", "") for o in offices if o.get("Name")][:12],
        "source": "api.postalpincode.in",
    })
