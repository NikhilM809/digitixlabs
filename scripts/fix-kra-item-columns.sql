-- Run BEFORE `npx prisma db push` when KraItem still has goal/target columns.
-- Fixes: "Added the required column name to KraItem without a default value"

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'KraItem' AND column_name = 'goal'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'KraItem' AND column_name = 'name'
  ) THEN
    ALTER TABLE "KraItem" RENAME COLUMN "goal" TO "name";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'KraItem' AND column_name = 'target'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'KraItem' AND column_name = 'measure'
  ) THEN
    ALTER TABLE "KraItem" RENAME COLUMN "target" TO "measure";
  END IF;
END $$;

ALTER TABLE "KraItem" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "KraItem"
SET "measure" = COALESCE(NULLIF(TRIM("measure"), ''), 'As defined by manager')
WHERE "measure" IS NULL OR TRIM("measure") = '';

UPDATE "KraItem"
SET "name" = COALESCE(NULLIF(TRIM("name"), ''), 'KRA')
WHERE "name" IS NULL OR TRIM("name") = '';
