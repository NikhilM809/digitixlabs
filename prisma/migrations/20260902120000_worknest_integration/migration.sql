-- Worknest (Project Management) tables integrated into HRMS PostgreSQL schema

CREATE TYPE "WnProjectStatus" AS ENUM ('BID', 'NEED_TO_START', 'SCRIPT_WIP', 'CHANGES', 'LIVE', 'HOLD', 'CLOSE', 'CANCEL');
CREATE TYPE "WnTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');
CREATE TYPE "WnInvoiceStatus" AS ENUM ('GENERATED', 'PAID');
CREATE TYPE "WnBillingStage" AS ENUM ('NONE', 'PENDING', 'APPROVAL_REQUIRED', 'APPROVED');
CREATE TYPE "WnHourStatus" AS ENUM ('SUBMITTED', 'REVIEWED');

CREATE TABLE "WnCurrency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnCurrency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnCurrency_code_key" ON "WnCurrency"("code");

CREATE TABLE "WnProject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "WnProjectStatus" NOT NULL DEFAULT 'BID',
    "managerId" TEXT NOT NULL,
    "sellValue" DOUBLE PRECISION NOT NULL,
    "initialSellValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "programmerHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "qaHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marginHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "initialEstimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valueAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "changesAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "currencyId" TEXT,
    "billingStage" "WnBillingStage" NOT NULL DEFAULT 'NONE',
    "estimatedHours" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3),
    "eta" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "selfAssignEnabled" BOOLEAN NOT NULL DEFAULT true,
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnProject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnProject_code_key" ON "WnProject"("code");
CREATE INDEX "WnProject_status_idx" ON "WnProject"("status");
CREATE INDEX "WnProject_managerId_idx" ON "WnProject"("managerId");
CREATE INDEX "WnProject_clientName_idx" ON "WnProject"("clientName");

ALTER TABLE "WnProject" ADD CONSTRAINT "WnProject_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WnProject" ADD CONSTRAINT "WnProject_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "WnCurrency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WnProject" ADD CONSTRAINT "WnProject_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorknestSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'Digitix Labs',
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "companyEmail" TEXT NOT NULL DEFAULT '',
    "companyPhone" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "panNumber" TEXT NOT NULL DEFAULT '',
    "tanNumber" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "lutNumber" TEXT NOT NULL DEFAULT '',
    "servicesDescription" TEXT NOT NULL DEFAULT 'Survey Programming and Consulting',
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "bankIfsc" TEXT NOT NULL DEFAULT '',
    "bankSwift" TEXT NOT NULL DEFAULT '',
    "bankMicr" TEXT NOT NULL DEFAULT '',
    "bankBranch" TEXT NOT NULL DEFAULT '',
    "bankBranchCode" TEXT NOT NULL DEFAULT '',
    "bankCountry" TEXT NOT NULL DEFAULT 'India',
    "billToName" TEXT NOT NULL DEFAULT '',
    "billToAddress" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "etaWarningDays" INTEGER NOT NULL DEFAULT 7,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'PP/DXL',
    CONSTRAINT "WorknestSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorknestNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorknestNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorknestNotification_userId_read_idx" ON "WorknestNotification"("userId", "read");
ALTER TABLE "WorknestNotification" ADD CONSTRAINT "WorknestNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WnProjectAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WnProjectAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnProjectAssignment_projectId_employeeId_key" ON "WnProjectAssignment"("projectId", "employeeId");
ALTER TABLE "WnProjectAssignment" ADD CONSTRAINT "WnProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnProjectAssignment" ADD CONSTRAINT "WnProjectAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WnProjectAssignment" ADD CONSTRAINT "WnProjectAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WnTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assignedEmployeeId" TEXT,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3),
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "status" "WnTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT NOT NULL DEFAULT '',
    "selfAssignEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WnTask" ADD CONSTRAINT "WnTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnTask" ADD CONSTRAINT "WnTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WnTask" ADD CONSTRAINT "WnTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WnTimeEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workType" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "WnHourStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WnTimeEntry_projectId_idx" ON "WnTimeEntry"("projectId");
CREATE INDEX "WnTimeEntry_employeeId_idx" ON "WnTimeEntry"("employeeId");
CREATE INDEX "WnTimeEntry_date_idx" ON "WnTimeEntry"("date");
ALTER TABLE "WnTimeEntry" ADD CONSTRAINT "WnTimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnTimeEntry" ADD CONSTRAINT "WnTimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WnTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WnTimeEntry" ADD CONSTRAINT "WnTimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WnTimeEntry" ADD CONSTRAINT "WnTimeEntry_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WnProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WnProjectNote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WnProjectNote" ADD CONSTRAINT "WnProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnProjectNote" ADD CONSTRAINT "WnProjectNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WnProjectStatusChange" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WnProjectStatusChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WnProjectStatusChange_projectId_idx" ON "WnProjectStatusChange"("projectId");
ALTER TABLE "WnProjectStatusChange" ADD CONSTRAINT "WnProjectStatusChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnProjectStatusChange" ADD CONSTRAINT "WnProjectStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WnInvoiceBatch" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "WnInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "source" TEXT NOT NULL DEFAULT 'GENERATED',
    "pdfPath" TEXT NOT NULL DEFAULT '',
    "servicesDescription" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnInvoiceBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnInvoiceBatch_invoiceNumber_key" ON "WnInvoiceBatch"("invoiceNumber");

CREATE TABLE "WnInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "batchId" TEXT,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT 'Rs.',
    "status" "WnInvoiceStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnInvoice_invoiceNumber_key" ON "WnInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "WnInvoice_projectId_billingMonth_billingYear_key" ON "WnInvoice"("projectId", "billingMonth", "billingYear");
ALTER TABLE "WnInvoice" ADD CONSTRAINT "WnInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnInvoice" ADD CONSTRAINT "WnInvoice_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WnInvoiceBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WnProjectExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "exportedById" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingMonth" INTEGER NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "exportType" TEXT NOT NULL DEFAULT 'APPROVAL',
    CONSTRAINT "WnProjectExport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WnProjectExport" ADD CONSTRAINT "WnProjectExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WnProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WnProjectExport" ADD CONSTRAINT "WnProjectExport_exportedById_fkey" FOREIGN KEY ("exportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WnClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WnClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnClient_name_key" ON "WnClient"("name");

CREATE TABLE "WnInvoiceService" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WnInvoiceService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnInvoiceService_name_key" ON "WnInvoiceService"("name");

CREATE TABLE "WnWorkTypeOption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WnWorkTypeOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WnWorkTypeOption_code_key" ON "WnWorkTypeOption"("code");
