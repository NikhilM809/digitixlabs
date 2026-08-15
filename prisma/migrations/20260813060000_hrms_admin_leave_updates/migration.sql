-- UserStatus: INACTIVE -> LEFT, SUSPENDED -> TERMINATED
CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'LEFT', 'TERMINATED');

ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING (
  CASE "status"::text
    WHEN 'ACTIVE' THEN 'ACTIVE'::"UserStatus_new"
    WHEN 'INACTIVE' THEN 'LEFT'::"UserStatus_new"
    WHEN 'SUSPENDED' THEN 'TERMINATED'::"UserStatus_new"
    ELSE 'LEFT'::"UserStatus_new"
  END
);
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "UserStatus";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";

-- CTC on User
ALTER TABLE "User" ADD COLUMN "ctc" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Late reason on Attendance
ALTER TABLE "Attendance" ADD COLUMN "lateReason" TEXT;

-- Dependent details toggle
ALTER TABLE "CompanySettings" ADD COLUMN "dependentDetailsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Employee dependents
CREATE TABLE "EmployeeDependent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDependent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeDependent_userId_idx" ON "EmployeeDependent"("userId");

ALTER TABLE "EmployeeDependent" ADD CONSTRAINT "EmployeeDependent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Remove holiday calendar
DROP TABLE IF EXISTS "HolidayCalendar";

-- Deactivate WFH and Half Day leave types; add Floater Leave
UPDATE "LeaveType" SET "isActive" = false WHERE "code" IN ('WFH', 'HD');

INSERT INTO "LeaveType" ("id", "name", "code", "description", "defaultDays", "isPaid", "requiresAttachment", "isActive", "createdAt", "updatedAt")
SELECT
  'clfloater00000000000000001',
  'Floater Leave',
  'FL',
  'Optional floater leave for special occasions',
  2,
  true,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE "code" = 'FL');
