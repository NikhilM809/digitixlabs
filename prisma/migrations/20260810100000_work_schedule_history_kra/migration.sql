-- Work schedule history + KRA management

CREATE TYPE "KraStatus" AS ENUM ('DRAFT', 'EMPLOYEE_SUBMITTED', 'UNDER_MANAGER_REVIEW', 'MANAGER_REVIEWED', 'COMPLETED');

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KraItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkScheduleEntry_userId_effectiveFrom_idx" ON "WorkScheduleEntry"("userId", "effectiveFrom");
CREATE UNIQUE INDEX "KraReview_userId_month_year_key" ON "KraReview"("userId", "month", "year");
CREATE INDEX "KraReview_managerId_status_idx" ON "KraReview"("managerId", "status");
CREATE INDEX "KraReview_userId_year_month_idx" ON "KraReview"("userId", "year", "month");
CREATE INDEX "KraItem_kraReviewId_idx" ON "KraItem"("kraReviewId");

ALTER TABLE "WorkScheduleEntry" ADD CONSTRAINT "WorkScheduleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KraReview" ADD CONSTRAINT "KraReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KraReview" ADD CONSTRAINT "KraReview_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KraItem" ADD CONSTRAINT "KraItem_kraReviewId_fkey" FOREIGN KEY ("kraReviewId") REFERENCES "KraReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
