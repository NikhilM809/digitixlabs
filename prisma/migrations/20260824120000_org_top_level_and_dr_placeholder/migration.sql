-- Top-level org employee, administrative DR placeholder, assignees

ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "topLevelEmployeeId" TEXT;

ALTER TABLE "CompanySettings" ADD CONSTRAINT "CompanySettings_topLevelEmployeeId_fkey"
  FOREIGN KEY ("topLevelEmployeeId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "OrgAdministrativePosition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgAdministrativePosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgAdministrativePosition_code_key"
  ON "OrgAdministrativePosition"("code");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "administrativePositionId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_administrativePositionId_fkey"
  FOREIGN KEY ("administrativePositionId") REFERENCES "OrgAdministrativePosition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_administrativePositionId_idx"
  ON "User"("administrativePositionId");

INSERT INTO "OrgAdministrativePosition" ("id", "code", "name", "description", "updatedAt")
VALUES (
  'org-admin-position-dr',
  'DR',
  'DR (Administrative Placeholder)',
  'Admin-only dummy position for organizational planning. Not visible to non-admin users.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
