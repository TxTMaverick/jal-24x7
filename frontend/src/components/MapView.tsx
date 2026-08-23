"use client";

/**
 * Leaflet + OpenStreetMap map.
 *
 * Free and key-less, unlike Google Maps which now requires a billing account
 * even on the free tier. the reason the synopsis's map choice was swapped.
 *
 * Leaflet's default marker PNGs resolve to broken URLs under a bundler, so
 * every marker here is a `divIcon` built from inline HTML instead. That also
 * lets markers match the app's visual language.
 */

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { cx } from "@/lib/format";

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  kind: "customer" | "vendor" | "courier" | "office";
  label?: string;
  sublabel?: string;
  active?: boolean;
  onSelect?: () => void;
}

const MARKER_STYLES: Record<MapMarker["kind"], { bg: string; ring: string; glyph: string }> = {
  customer: { bg: "#1f80f0", ring: "rgba(31,128,240,.28)", glyph: "&#9679;" },
  vendor: { bg: "#0f2540", ring: "rgba(15,37,64,.22)", glyph: "&#9650;" },
  courier: { bg: "#f59e0b", ring: "rgba(245,158,11,.32)", glyph: "&#9654;" },
  office: { bg: "#10b981", ring: "rgba(16,185,129,.28)", glyph: "&#9632;" },
};

function buildIcon(marker: MapMarker): L.DivIcon {
  const style = MARKER_STYLES[marker.kind];
  const size = marker.active ? 34 : 28;
  const pulse =
    marker.kind === "courier"
      ? `<span style="position:absolute;inset:-8px;border-radius:9999px;background:${style.ring};animation:jalpulse 1.6s ease-out infinite"></span>`
      : "";

  return L.divIcon({
    className: "jal-marker",
    html: `
      <div style="position:relative;display:grid;place-items:center;width:${size}px;height:${size}px">
        ${pulse}
        <div style="
          position:relative;width:${size}px;height:${size}px;border-radius:9999px;
          background:${style.bg};color:#fff;display:grid;place-items:center;
          font-size:${size / 2.6}px;line-height:1;
          box-shadow:0 0 0 4px ${style.ring}, 0 4px 10px rgba(15,37,64,.28);
          border:2px solid #fff;">
          ${style.glyph}
        </div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Keeps the viewport sensible as markers change. */
function ViewController({
  markers,
  center,
  zoom,
  follow,
}: {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
  follow?: [number, number] | null;
}) {
  const map = useMap();
  const fittedRef = useRef(false);

  // Fit all markers once on first load.
  useEffect(() => {
    if (fittedRef.current || markers.length === 0) return;
    fittedRef.current = true;

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], zoom);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [map, markers, zoom]);

  // Pan smoothly to follow a moving courier.
  useEffect(() => {
    if (!follow) return;
    map.panTo(follow, { animate: true, duration: 0.9 });
  }, [map, follow]);

  // Leaflet miscalculates size when its container starts hidden or resizes.
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 180);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [map]);

  // Silence the unused-var lint on `center` while keeping the prop meaningful.
  void center;
  return null;
}

/** Turns a click anywhere on the map into a lat/lng. used for pin drop. */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function MapView({
  markers,
  center,
  zoom = 13,
  className,
  follow,
  polyline,
  onPick,
  scrollWheelZoom = false,
}: {
  markers: MapMarker[];
  center: [number, number];
  zoom?: number;
  className?: string;
  follow?: [number, number] | null;
  polyline?: [number, number][];
  onPick?: (lat: number, lng: number) => void;
  scrollWheelZoom?: boolean;
}) {
  const icons = useMemo(() => markers.map((m) => ({ marker: m, icon: buildIcon(m) })), [markers]);

  return (
    <div className={cx("relative overflow-hidden rounded-2xl ring-1 ring-ink-200", className)}>
      <style>{`@keyframes jalpulse{0%{transform:scale(.7);opacity:.85}100%{transform:scale(1.9);opacity:0}}`}</style>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        className={cx("size-full", onPick && "cursor-crosshair")}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ViewController markers={markers} center={center} zoom={zoom} follow={follow} />
        {onPick && <ClickCapture onPick={onPick} />}

        {polyline && polyline.length > 1 && <RouteLine points={polyline} />}

        {icons.map(({ marker, icon }) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={icon}
            eventHandlers={marker.onSelect ? { click: marker.onSelect } : undefined}
          >
            {(marker.label || marker.sublabel) && (
              <Popup>
                <span className="block text-sm font-semibold text-ink-900">{marker.label}</span>
                {marker.sublabel && (
                  <span className="mt-0.5 block text-xs text-ink-500">{marker.sublabel}</span>
                )}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/** Dashed route line drawn with the raw Leaflet API (no extra component dep). */
function RouteLine({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    const line = L.polyline(points, {
      color: "#1f80f0",
      weight: 3,
      opacity: 0.6,
      dashArray: "7 9",
      lineCap: "round",
    }).addTo(map);
    return () => {
      line.remove();
    };
  }, [map, points]);

  return null;
}
