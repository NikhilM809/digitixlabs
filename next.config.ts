import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import { resolve } from "path";

// Load .env files explicitly (helps on Windows)
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "digitix-hrms-local-dev-secret-2026";

const AUTH_URL =
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    AUTH_SECRET,
    NEXTAUTH_SECRET: AUTH_SECRET,
    AUTH_URL,
    NEXTAUTH_URL: AUTH_URL,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "digitixlabs.com" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
};

export default nextConfig;
