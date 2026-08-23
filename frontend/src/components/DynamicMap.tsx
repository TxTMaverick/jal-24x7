"use client";

/**
 * SSR-safe wrapper around MapView.
 *
 * Leaflet touches `window` at import time, so the map must never render on the
 * server. `ssr: false` keeps it out of the server bundle and shows a skeleton
 * until the chunk arrives.
 */

import dynamic from "next/dynamic";

import { cx } from "@/lib/format";
import type { MapMarker } from "./MapView";

export type { MapMarker };

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "skeleton grid place-items-center rounded-2xl ring-1 ring-ink-200",
        className ?? "h-full min-h-64",
      )}
    >
      <span className="text-xs font-medium text-ink-400">Loading map…</span>
    </div>
  );
}

export default MapView;
