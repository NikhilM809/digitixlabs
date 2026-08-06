# Windows one-time setup script for Digitix HRMS
# Run in PowerShell:  .\scripts\setup-windows.ps1

Write-Host "=== Digitix HRMS Windows Setup ===" -ForegroundColor Cyan

$envContent = @"
DATABASE_URL="postgresql://hrms:hrms_password@localhost:5432/digitix_hrms?schema=public"
AUTH_SECRET="digitix-hrms-local-dev-secret-2026"
AUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="digitix-hrms-local-dev-secret-2026"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="digitix-jwt-secret-key-change-in-production-2026"
NEXT_PUBLIC_APP_NAME="Digitix HRMS"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
"@

if (-not (Test-Path ".env.local")) {
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8NoBOM
    Write-Host "Created .env.local" -ForegroundColor Green
} else {
    Write-Host ".env.local already exists - skipping" -ForegroundColor Yellow
}

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Clearing Next.js cache..." -ForegroundColor Cyan
if (Test-Path ".next") { Remove-Item -Recurse -Force ".next" }

Write-Host ""
Write-Host "=== Setup complete ===" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Make sure PostgreSQL is running"
Write-Host "  2. Run: npm run db:push"
Write-Host "  3. Run: npm run db:seed"
Write-Host "  4. Run: npm run dev"
Write-Host "  5. Open: http://localhost:3000/login"
Write-Host ""
Write-Host "Login: admin@digitixlabs.com / Admin@123" -ForegroundColor Yellow
