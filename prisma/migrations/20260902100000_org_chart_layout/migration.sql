-- Visual org chart layout (does not affect reporting relationships)
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "orgChartLayoutJson" TEXT;
