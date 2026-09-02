-- Salary components on employee and payslip records
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hra" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "specialAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "internetAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "performanceBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "hra" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "specialAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "internetAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "performanceBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Map legacy compensation fields into the new structure
UPDATE "User"
SET
  "specialAllowance" = CASE WHEN "specialAllowance" = 0 THEN COALESCE("incentive", 0) ELSE "specialAllowance" END,
  "internetAllowance" = CASE WHEN "internetAllowance" = 0 THEN COALESCE("reimbursement", 0) ELSE "internetAllowance" END
WHERE "incentive" > 0 OR "reimbursement" > 0;

UPDATE "Payslip"
SET
  "performanceBonus" = CASE WHEN "performanceBonus" = 0 THEN COALESCE("bonus", 0) ELSE "performanceBonus" END,
  "specialAllowance" = CASE WHEN "specialAllowance" = 0 THEN COALESCE("incentive", 0) ELSE "specialAllowance" END,
  "internetAllowance" = CASE WHEN "internetAllowance" = 0 THEN COALESCE("reimbursement", 0) ELSE "internetAllowance" END
WHERE "bonus" > 0 OR "incentive" > 0 OR "reimbursement" > 0;

-- Admin-controlled employee profile editing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileEditingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "defaultEmployeeProfileEditingEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "profileCompletedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "profileCompletedAt" IS NULL;
