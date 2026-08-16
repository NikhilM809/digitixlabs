-- Run in pgAdmin/psql if leave types still show Work From Home / Half Day
-- or Floater Leave is missing.

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

-- Dependent details toggle (if column missing after db push):
-- ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "dependentDetailsEnabled" BOOLEAN NOT NULL DEFAULT false;
