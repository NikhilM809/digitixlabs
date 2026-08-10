# Baseline an existing database then apply pending migrations (fixes P3005).
# Use ONLY if your DB already has tables from init + HR updates but _prisma_migrations is empty.
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/baseline-and-deploy.ps1

Write-Host ""
Write-Host "=== Baseline + migrate deploy ===" -ForegroundColor Cyan
Write-Host "Marks older migrations as already applied, then runs migrate deploy."
Write-Host ""

$baseline = @(
  "20260806000000_init",
  "20260808000000_hr_role_and_policies",
  "20260810000000_work_schedule_leave_manual"
)

foreach ($name in $baseline) {
  Write-Host "Marking as applied: $name"
  npx prisma migrate resolve --applied $name
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: resolve failed for $name (may already be recorded)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Applying pending migrations..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Deploy failed. Try instead:  powershell -File scripts/apply-schema-windows.ps1" -ForegroundColor Yellow
  exit 1
}

npx prisma generate
Write-Host ""
Write-Host "Done. Restart:  npm run dev" -ForegroundColor Green
Write-Host ""
