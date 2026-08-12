-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN "orgHierarchyVisibleToEmployees" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CompanySettings" ADD COLUMN "orgHierarchyVisibleToManagers" BOOLEAN NOT NULL DEFAULT true;
