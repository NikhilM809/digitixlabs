-- Employee PAN and company TAN for payslips

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pan" TEXT;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "companyTan" TEXT;
