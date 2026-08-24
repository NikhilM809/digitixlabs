-- Admin-controlled employee profile editing

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileEditingEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "defaultEmployeeProfileEditingEnabled" BOOLEAN NOT NULL DEFAULT false;
