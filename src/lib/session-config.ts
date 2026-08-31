import { prisma } from "@/lib/prisma";

const CACHE_TTL_MS = 60_000;
let cachedMaxAgeSeconds: number | null = null;
let cachedAt = 0;

/** Session lifetime in seconds, sourced from company settings with a safe fallback. */
export async function getSessionMaxAgeSeconds(): Promise<number> {
  const now = Date.now();
  if (cachedMaxAgeSeconds !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedMaxAgeSeconds;
  }

  try {
    const settings = await prisma.companySettings.findFirst({
      select: { sessionTimeout: true },
    });
    const minutes = settings?.sessionTimeout ?? 480;
    cachedMaxAgeSeconds = Math.max(5, minutes) * 60;
  } catch {
    cachedMaxAgeSeconds = 480 * 60;
  }

  cachedAt = now;
  return cachedMaxAgeSeconds;
}
