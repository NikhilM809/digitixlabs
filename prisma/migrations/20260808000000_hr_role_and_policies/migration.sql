-- Add HR role and CompanyPolicy table (backward-compatible)

ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'HR';

CREATE TABLE IF NOT EXISTS "CompanyPolicy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPolicy_pkey" PRIMARY KEY ("id")
);
