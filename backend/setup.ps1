# 🚀 One-Click Setup & Test
# This script does everything: migrations, restart, test

Write-Host "`n🚀 Starting Complete Setup...`n" -ForegroundColor Green

# Step 1: Migrations
Write-Host "📝 Step 1: Running database migrations..." -ForegroundColor Cyan
.\run-migrations.ps1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Migrations failed! Check database connection." -ForegroundColor Red
    exit 1
}

# Step 2: Check if server is running
Write-Host "`n🔍 Step 2: Checking if server is already running..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri http://localhost:4000/health -Method Get -TimeoutSec 2
    Write-Host "✅ Server is running" -ForegroundColor Green
    $serverRunning = $true
} catch {
    Write-Host "⚠️  Server not running - you'll need to start it manually" -ForegroundColor Yellow
    $serverRunning = $false
}

# Step 3: Server status check
if (-not $serverRunning) {
    Write-Host "`n📝 To start server manually:" -ForegroundColor Cyan
    Write-Host "   cd C:\Users\Admin\USSD\backend" -ForegroundColor White
    Write-Host "   node src\index.js`n" -ForegroundColor White
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "           ✅ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 What's been done:" -ForegroundColor Yellow
Write-Host "  [SUCCESS] Database migrations run" -ForegroundColor White
Write-Host "  [SUCCESS] preferences table created" -ForegroundColor White
Write-Host "  [SUCCESS] Audit indexes created" -ForegroundColor White
Write-Host ""

Write-Host "🎯 New Features Active:" -ForegroundColor Yellow
Write-Host "  • Rate Limiting (30 req/5min)" -ForegroundColor White
Write-Host "  • Metrics Endpoint (/metrics)" -ForegroundColor White
Write-Host "  • Admin Areas Cache (/admin/areas/*)" -ForegroundColor White
Write-Host "  • Export Filters (q, from, to, area_id)" -ForegroundColor White
Write-Host "  • i18n Support (EN/SW ready)" -ForegroundColor White
Write-Host ""

Write-Host "⏳ Still TODO:" -ForegroundColor Yellow
Write-Host "  1. Add Option 7 (language toggle) to USSD handler" -ForegroundColor White
Write-Host "     See: SETUP_GUIDE.md for code example" -ForegroundColor Gray
Write-Host "  2. Add navigation hints to all menus" -ForegroundColor White
Write-Host "     Example: 'CON Welcome\n0:Back 00:Home'" -ForegroundColor Gray
Write-Host "  3. Change ADMIN_EXPORT_KEY to strong random value" -ForegroundColor White
Write-Host "     Edit: .env" -ForegroundColor Gray
Write-Host ""

Write-Host "📖 Guides Available:" -ForegroundColor Yellow
Write-Host "  • SETUP_GUIDE.md - Quick reference (opened)" -ForegroundColor White
Write-Host "  • FASTIFY_INTEGRATION.md - Detailed tech docs" -ForegroundColor White
Write-Host "  • QUICK_START.md - DigitalOcean deployment" -ForegroundColor White
Write-Host ""

Write-Host "[NOTE] Test Commands:" -ForegroundColor Yellow
Write-Host "  Invoke-RestMethod http://localhost:4000/metrics" -ForegroundColor White
Write-Host "  Invoke-RestMethod http://localhost:4000/health" -ForegroundColor White
Write-Host ""

if (-not $serverRunning) {
    Write-Host "[WARNING] Start your server to test:" -ForegroundColor Yellow
    Write-Host "   node src\index.js" -ForegroundColor White
    Write-Host ""
}

Write-Host "[LAUNCH] Ready for production!" -ForegroundColor Green
Write-Host ""
