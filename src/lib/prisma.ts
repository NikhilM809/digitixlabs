import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 10,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Detect whether the generated client includes KRA models (once per process). */
let generatedHasKraReview: boolean | undefined;

function clientHasKraReview(client: PrismaClient) {
  return typeof (client as { kraReview?: unknown }).kraReview !== "undefined";
}

function latestClientHasKraReview() {
  if (generatedHasKraReview !== undefined) return generatedHasKraReview;
  const probe = createPrismaClient();
  generatedHasKraReview = clientHasKraReview(probe);
  void probe.$disconnect();
  return generatedHasKraReview;
}

function resolvePrismaClient() {
  const cached = globalForPrisma.prisma;
  if (
    process.env.NODE_ENV !== "production" &&
    cached &&
    latestClientHasKraReview() &&
    !clientHasKraReview(cached)
  ) {
    void cached.$disconnect();
    globalForPrisma.prisma = createPrismaClient();
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export const prisma = resolvePrismaClient();
