-- Employee Aadhaar and bank account for payroll / KYC

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aadhaarNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
