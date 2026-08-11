-- CreateEnum
CREATE TYPE "KraReviewCycle" AS ENUM ('MONTHLY', 'QUARTERLY');

-- AlterTable
ALTER TABLE "EmployeeKraConfig" ADD COLUMN "reviewCycle" "KraReviewCycle" NOT NULL DEFAULT 'MONTHLY';
