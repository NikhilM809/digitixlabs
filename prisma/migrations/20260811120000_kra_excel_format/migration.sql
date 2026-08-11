-- Align KRA with Digitix Excel sheet (Akhil APR26-JUL26 format)

ALTER TABLE "EmployeeKra" ALTER COLUMN "weight" DROP NOT NULL;

ALTER TABLE "EmployeeKraConfig" ADD COLUMN IF NOT EXISTS "periodLabel" TEXT;
ALTER TABLE "EmployeeKraConfig" ADD COLUMN IF NOT EXISTS "remarks" TEXT;

ALTER TABLE "KraItem" ADD COLUMN IF NOT EXISTS "employeePercentage" DOUBLE PRECISION;
ALTER TABLE "KraItem" ADD COLUMN IF NOT EXISTS "managerPercentage" DOUBLE PRECISION;
