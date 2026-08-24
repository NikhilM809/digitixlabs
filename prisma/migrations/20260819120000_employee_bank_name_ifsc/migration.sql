-- Bank name and IFSC code for employee bank details

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ifscCode" TEXT;
