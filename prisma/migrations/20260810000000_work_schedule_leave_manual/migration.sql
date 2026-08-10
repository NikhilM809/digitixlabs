-- Per-employee work schedule + manual used leave override

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workStartTime" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workEndTime" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lateThreshold" INTEGER;

ALTER TABLE "LeaveBalance" ADD COLUMN IF NOT EXISTS "usedDaysManual" BOOLEAN NOT NULL DEFAULT false;
