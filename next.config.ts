import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "digitixlabs.com" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

export default nextConfig;
