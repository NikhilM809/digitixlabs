/** Normalize email/username for storage and login lookup (lowercase, trimmed). */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
