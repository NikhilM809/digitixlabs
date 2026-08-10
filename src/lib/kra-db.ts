import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-utils";

const KRA_SETUP_MESSAGE =
  "KRA is not ready. Stop the dev server (Ctrl+C), then run: npx prisma db push && npx prisma generate && npm run dev";

/** Prisma client is stale or schema not synced if kraReview is missing */
export function isKraDbReady(): boolean {
  return typeof (prisma as { kraReview?: unknown }).kraReview !== "undefined";
}

export function kraDbSetupError() {
  if (isKraDbReady()) return null;
  return apiError(KRA_SETUP_MESSAGE, 503);
}

export function getKraReviewDelegate() {
  if (!isKraDbReady()) {
    throw new Error(KRA_SETUP_MESSAGE);
  }
  return prisma.kraReview;
}

export function getKraItemDelegate() {
  if (!isKraDbReady()) {
    throw new Error(KRA_SETUP_MESSAGE);
  }
  return prisma.kraItem;
}

export function isKraSetupFailure(err: unknown) {
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : "";
  return (
    message.includes("KRA is not ready") ||
    message.includes("KraReview") ||
    message.includes("does not exist") ||
    message.includes("P2021")
  );
}
