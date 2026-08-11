-- CreateTable
CREATE TABLE "ReportingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managerId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportingHistory_userId_effectiveFrom_idx" ON "ReportingHistory"("userId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ReportingHistory_managerId_idx" ON "ReportingHistory"("managerId");

-- AddForeignKey
ALTER TABLE "ReportingHistory" ADD CONSTRAINT "ReportingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingHistory" ADD CONSTRAINT "ReportingHistory_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingHistory" ADD CONSTRAINT "ReportingHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
