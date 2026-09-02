-- Merge Maternity (ML) and Paternity (PL) into Maternity/Parental Leave (PRL)

INSERT INTO "LeaveType" (
  "id",
  "name",
  "code",
  "description",
  "defaultDays",
  "isPaid",
  "requiresAttachment",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'Maternity/Parental Leave',
  'PRL',
  'Parental leave (maternity/paternity). Days are assigned per employee as required.',
  0,
  true,
  false,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "defaultDays" = EXCLUDED."defaultDays",
  "isActive" = true,
  "updatedAt" = NOW();

UPDATE "LeaveType"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "code" IN ('ML', 'PL');

-- Point existing leave requests at Maternity/Parental Leave
UPDATE "LeaveRequest" lr
SET "leaveTypeId" = prl."id", "updatedAt" = NOW()
FROM "LeaveType" prl
WHERE prl."code" = 'PRL'
  AND lr."leaveTypeId" IN (SELECT "id" FROM "LeaveType" WHERE "code" IN ('ML', 'PL'));

-- Merge leave balances: combine ML/PL totals into PRL per user/year
INSERT INTO "LeaveBalance" (
  "id",
  "userId",
  "leaveTypeId",
  "year",
  "totalDays",
  "usedDays",
  "pendingDays",
  "usedDaysManual",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  lb."userId",
  prl."id",
  lb."year",
  SUM(lb."totalDays"),
  SUM(lb."usedDays"),
  SUM(lb."pendingDays"),
  BOOL_OR(lb."usedDaysManual"),
  NOW(),
  NOW()
FROM "LeaveBalance" lb
JOIN "LeaveType" lt ON lt."id" = lb."leaveTypeId"
CROSS JOIN "LeaveType" prl
WHERE lt."code" IN ('ML', 'PL')
  AND prl."code" = 'PRL'
GROUP BY lb."userId", prl."id", lb."year"
ON CONFLICT ("userId", "leaveTypeId", "year") DO UPDATE SET
  "totalDays" = "LeaveBalance"."totalDays" + EXCLUDED."totalDays",
  "usedDays" = "LeaveBalance"."usedDays" + EXCLUDED."usedDays",
  "pendingDays" = "LeaveBalance"."pendingDays" + EXCLUDED."pendingDays",
  "usedDaysManual" = "LeaveBalance"."usedDaysManual" OR EXCLUDED."usedDaysManual",
  "updatedAt" = NOW();

DELETE FROM "LeaveBalance" lb
USING "LeaveType" lt
WHERE lb."leaveTypeId" = lt."id"
  AND lt."code" IN ('ML', 'PL');
