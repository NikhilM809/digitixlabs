/** Auth secret — must match between middleware and NextAuth handlers */
export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  "digitix-hrms-local-dev-secret-2026";

export const AUTH_URL =
  process.env.NEXTAUTH_URL ||
  process.env.AUTH_URL ||
  "http://localhost:3000";
