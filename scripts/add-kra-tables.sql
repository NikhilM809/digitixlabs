-- Run this in pgAdmin / psql if "npx prisma db push" cannot be used.
-- Database: digitix_hrms (or your DATABASE_URL database)
--
-- psql example:
--   psql -U hrms -d digitix_hrms -f scripts/add-kra-tables.sql

DO $$ BEGIN
  CREATE TYPE "KraStatus" AS ENUM (
    'DRAFT',
    'EMPLOYEE_SUBMITTED',
    'UNDER_MANAGER_REVIEW',
    'MANAGER_REVIEWED',
    'COMPLETED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "WorkScheduleEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "workStartTime" TEXT NOT NULL,
  "workEndTime" TEXT NOT NULL,
  "lateThreshold" INTEGER,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkScheduleEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KraReview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "managerId" TEXT,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "status" "KraStatus" NOT NULL DEFAULT 'DRAFT',
  "employeeSubmittedAt" TIMESTAMP(3),
  "managerReviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KraReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KraItem" (
  "id" TEXT NOT NULL,
  "kraReviewId" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "description" TEXT,
  "target" TEXT,
  "achievement" TEXT,
  "employeeComments" TEXT,
  "employeeRating" DOUBLE PRECISION,
  "managerRating" DOUBLE PRECISION,
  "managerComments" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KraItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkScheduleEntry_userId_effectiveFrom_idx"
  ON "WorkScheduleEntry"("userId", "effectiveFrom");
CREATE UNIQUE INDEX IF NOT EXISTS "KraReview_userId_month_year_key"
  ON "KraReview"("userId", "month", "year");
CREATE INDEX IF NOT EXISTS "KraReview_managerId_status_idx"
  ON "KraReview"("managerId", "status");
CREATE INDEX IF NOT EXISTS "KraReview_userId_year_month_idx"
  ON "KraReview"("userId", "year", "month");
CREATE INDEX IF NOT EXISTS "KraItem_kraReviewId_idx"
  ON "KraItem"("kraReviewId");

DO $$ BEGIN
  ALTER TABLE "WorkScheduleEntry"
    ADD CONSTRAINT "WorkScheduleEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "KraReview"
    ADD CONSTRAINT "KraReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "KraReview"
    ADD CONSTRAINT "KraReview_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "KraItem"
    ADD CONSTRAINT "KraItem_kraReviewId_fkey"
    FOREIGN KEY ("kraReviewId") REFERENCES "KraReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional columns from later migration (safe if already present)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pan" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "incentive" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reimbursement" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "companyTan" TEXT;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "incentive" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "reimbursement" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "EmployeeKra" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeKra_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeKraConfig" (
  "userId" TEXT NOT NULL,
  "isFinalized" BOOLEAN NOT NULL DEFAULT false,
  "finalizedAt" TIMESTAMP(3),
  "finalizedById" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeKraConfig_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX IF NOT EXISTS "EmployeeKra_userId_idx" ON "EmployeeKra"("userId");
