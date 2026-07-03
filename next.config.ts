import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client router cache for dynamic pages: switching back to a recently
    // visited tab reuses the payload instead of re-querying the (distant)
    // DB on every click. Mutations still bust it via router.refresh().
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
