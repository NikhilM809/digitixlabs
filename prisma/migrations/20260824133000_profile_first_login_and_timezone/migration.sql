-- Employee first-login profile completion + company timezone for attendance

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- Existing employees keep their current profile locked after this change.
UPDATE "User"
SET "profileCompletedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "profileCompletedAt" IS NULL;
