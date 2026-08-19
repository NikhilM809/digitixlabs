-- Custom Roles & Permissions Management

-- CreateEnum
CREATE TYPE "CustomRoleStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RoleAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'DUPLICATE', 'ACTIVATE', 'DEACTIVATE', 'PERMISSION_CHANGE', 'ASSIGN', 'REMOVE');

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN IF NOT EXISTS "action" TEXT;

-- CreateTable
CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT,
    "managerId" TEXT,
    "status" "CustomRoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemRoleKey" "RoleName",
    "hierarchyLevel" INTEGER NOT NULL DEFAULT 0,
    "parentRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomRolePermission" (
    "id" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "CustomRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserCustomRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCustomRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoleAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "RoleAuditAction" NOT NULL,
    "customRoleId" TEXT,
    "userId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");
CREATE UNIQUE INDEX "CustomRole_code_key" ON "CustomRole"("code");
CREATE INDEX "CustomRole_status_idx" ON "CustomRole"("status");
CREATE INDEX "CustomRole_departmentId_idx" ON "CustomRole"("departmentId");
CREATE INDEX "CustomRole_parentRoleId_idx" ON "CustomRole"("parentRoleId");
CREATE INDEX "CustomRole_isSystem_idx" ON "CustomRole"("isSystem");

CREATE UNIQUE INDEX "CustomRolePermission_customRoleId_permissionId_key" ON "CustomRolePermission"("customRoleId", "permissionId");
CREATE INDEX "CustomRolePermission_permissionId_idx" ON "CustomRolePermission"("permissionId");

CREATE INDEX "UserCustomRole_userId_idx" ON "UserCustomRole"("userId");
CREATE INDEX "UserCustomRole_customRoleId_idx" ON "UserCustomRole"("customRoleId");
CREATE INDEX "UserCustomRole_effectiveFrom_effectiveTo_idx" ON "UserCustomRole"("effectiveFrom", "effectiveTo");

CREATE INDEX "RoleAuditLog_customRoleId_idx" ON "RoleAuditLog"("customRoleId");
CREATE INDEX "RoleAuditLog_userId_idx" ON "RoleAuditLog"("userId");
CREATE INDEX "RoleAuditLog_createdAt_idx" ON "RoleAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomRole" ADD CONSTRAINT "CustomRole_parentRoleId_fkey" FOREIGN KEY ("parentRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomRolePermission" ADD CONSTRAINT "CustomRolePermission_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomRolePermission" ADD CONSTRAINT "CustomRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserCustomRole" ADD CONSTRAINT "UserCustomRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCustomRole" ADD CONSTRAINT "UserCustomRole_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCustomRole" ADD CONSTRAINT "UserCustomRole_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RoleAuditLog" ADD CONSTRAINT "RoleAuditLog_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
