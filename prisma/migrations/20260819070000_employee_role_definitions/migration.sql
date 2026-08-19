-- Employee role definitions (Admin, HR, CEO, Delivery Manager, etc.)

CREATE TABLE "EmployeeRoleDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "accessLevel" "RoleName" NOT NULL DEFAULT 'EMPLOYEE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRoleDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeRoleDefinition_name_key" ON "EmployeeRoleDefinition"("name");
CREATE UNIQUE INDEX "EmployeeRoleDefinition_code_key" ON "EmployeeRoleDefinition"("code");
CREATE INDEX "EmployeeRoleDefinition_isActive_idx" ON "EmployeeRoleDefinition"("isActive");
CREATE INDEX "EmployeeRoleDefinition_accessLevel_idx" ON "EmployeeRoleDefinition"("accessLevel");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgRoleId" TEXT;
CREATE INDEX IF NOT EXISTS "User_orgRoleId_idx" ON "User"("orgRoleId");

ALTER TABLE "User" ADD CONSTRAINT "User_orgRoleId_fkey"
  FOREIGN KEY ("orgRoleId") REFERENCES "EmployeeRoleDefinition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
