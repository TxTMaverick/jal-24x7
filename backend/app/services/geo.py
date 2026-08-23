"""Geospatial helpers.

Kept dependency-free on purpose: no PostGIS, no Google Maps API, no billing
account. Great-circle distance is more than accurate enough at city scale
(errors are well under 1% over a few tens of kilometres).
"""

from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088

# Real road networks are never straight lines. 1.35 is a commonly used
# circuity factor for Indian urban road grids -- it keeps ETA estimates honest
# without needing a routing engine.
CIRCUITY_FACTOR = 1.35


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two WGS-84 points, in kilometres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_phi = p2 - p1
    d_lambda = math.radians(lng2 - lng1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def road_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance inflated by the road circuity factor."""
    return haversine_km(lat1, lng1, lat2, lng2) * CIRCUITY_FACTOR


def interpolate(
    start: tuple[float, float], end: tuple[float, float], progress: float
) -> tuple[float, float]:
    """Point `progress` (0..1) of the way from `start` to `end`.

    Used by the delivery-tracking simulator to walk a courier towards the
    customer pin. Linear interpolation is fine over city distances.
    """
    progress = max(0.0, min(1.0, progress))
    return (
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
    )


def bounding_box(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Cheap pre-filter box (min_lat, max_lat, min_lng, max_lng).

    Lets the database discard far-away vendors with a plain indexed comparison
    before we pay for a haversine call on each remaining row.
    """
    lat_delta = radius_km / 110.574
    # Longitude degrees shrink as you move away from the equator.
    lng_delta = radius_km / (111.320 * max(math.cos(math.radians(lat)), 0.01))
    return (lat - lat_delta, lat + lat_delta, lng - lng_delta, lng + lng_delta)
