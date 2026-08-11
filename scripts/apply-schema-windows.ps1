# Apply Prisma schema on Windows when migrate dev/deploy fails (P3014 / P3005).
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/apply-schema-windows.ps1

Write-Host ""
Write-Host "=== Digitix HRMS: sync database schema ===" -ForegroundColor Cyan
Write-Host "Uses 'prisma db push' — no shadow database, no migration history required."
Write-Host ""

npx prisma db push
if ($LASTEXITCODE -ne 0) {
  Write-Host "db push failed. Check DATABASE_URL in .env" -ForegroundColor Red
  exit 1
}

npx prisma generate
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "Expected new tables after sync:" -ForegroundColor Yellow
Write-Host "  - WorkScheduleEntry"
Write-Host "  - KraReview"
Write-Host "  - KraItem"
Write-Host ""
Write-Host "If db push fails, run SQL manually:" -ForegroundColor Yellow
Write-Host "  psql -U hrms -d digitix_hrms -f scripts/add-kra-tables.sql"
Write-Host ""
Write-Host "Schema synced. Restart the app:  npm run dev" -ForegroundColor Green
Write-Host ""
