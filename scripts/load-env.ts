import { config } from "dotenv";
import { resolve } from "path";

// Match Next.js: .env.local overrides .env
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error(
      "DATABASE_URL is missing. Create /var/www/hrms/.env.local with:\n" +
        'DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/digitix_hrms?schema=public"'
    );
    process.exit(1);
  }
  return url;
}
