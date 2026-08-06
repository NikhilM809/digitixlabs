/**
 * Auth secret used by NextAuth in both Node.js and Edge (middleware).
 * Edge runtime cannot read .env at runtime on all platforms, so we provide
 * a local dev fallback. Set AUTH_SECRET in .env for production.
 */
export const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "digitix-hrms-local-dev-secret-2026";

export const AUTH_URL =
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000";
