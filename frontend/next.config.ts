import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Serve the product photographs as-is.
     *
     * Next's image optimiser resizes on demand at runtime, which loads sharp
     * and holds decoded bitmaps in memory. On a 512 MB free instance that is a
     * real risk of the process being killed. Our 16 photos are already sized
     * and compressed for the layouts that use them, so on-the-fly optimisation
     * buys very little and costs the headroom we need.
     */
    unoptimized: true,
  },
};

export default nextConfig;
