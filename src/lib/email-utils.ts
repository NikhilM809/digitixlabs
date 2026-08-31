/** Normalize email for login and lookups (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
