"use client";

/**
 * SSR-safe wrapper around MapView.
 *
 * Leaflet touches `window` at import time, so the map must never render on the
 * server. `ssr: false` keeps it out of the server bundle and shows a skeleton
 * until the chunk arrives.
 */

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

import { cx } from "@/lib/format";
// Type-only: a value import here would pull Leaflet into the server bundle
// and defeat the `ssr: false` below, which is the whole point of this file.
import type { default as MapViewType, MapMarker } from "./MapView";

export type { MapMarker };

type MapProps = ComponentProps<typeof MapViewType>;

const LazyMapView = dynamic(() => import("./MapView"), {
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

/**
 * Reserves the caller's height while the Leaflet chunk downloads.
 *
 * `dynamic`'s own `loading` element cannot see the props, so on its own the
 * placeholder collapsed to its minimum and the page jumped once the map
 * arrived. Wrapping it keeps the sized box on screen throughout.
 */
export default function DynamicMap(props: MapProps) {
  return (
    <div className={cx("relative", props.className)}>
      <LazyMapView {...props} className="absolute inset-0 size-full" />
    </div>
  );
}
