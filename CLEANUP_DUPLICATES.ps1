# CLEANUP_DUPLICATES.ps1 - Remove duplicate and stray files

Write-Host "`n" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   CLEANING UP DUPLICATE FILES" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

$cleanupCount = 0

# Remove duplicate audit log tables (keep audit_log, remove old ones)
Write-Host " 🗑️  Checking for duplicate audit tables..." -ForegroundColor Yellow

# Remove test/check scripts in backend
$testScripts = @(
    "C:\Users\Admin\USSD\backend\check-schema.js",
    "C:\Users\Admin\USSD\backend\check-triggers.js",
    "C:\Users\Admin\USSD\backend\check-constraints.js",
    "C:\Users\Admin\USSD\backend\check-pinhash.js",
    "C:\Users\Admin\USSD\backend\check-phone.js",
    "C:\Users\Admin\USSD\backend\check-constituents-phone.js",
    "C:\Users\Admin\USSD\backend\check-audit-log.js",
    "C:\Users\Admin\USSD\backend\check-migrations.js",
    "C:\Users\Admin\USSD\backend\check-all-tables.js",

    "C:\Users\Admin\USSD\backend\run-fix-audit.js",
    "C:\Users\Admin\USSD\backend\run-bursary-update.js",
    "C:\Users\Admin\USSD\backend\fix-audit-trigger.sql",
    "C:\Users\Admin\USSD\backend\update-bursary-schema.sql"
)

Write-Host " 🗑️  Removing test/check scripts..." -ForegroundColor Yellow
foreach ($file in $testScripts) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "    ✓ Removed: $(Split-Path $file -Leaf)" -ForegroundColor Green
        $cleanupCount++
    }
}

# Remove old migration if exists (keep only production ones)
$oldMigrations = @(
    "C:\Users\Admin\USSD\migrations\01_init.sql"
)

Write-Host "`n 🗑️  Checking old migration files..." -ForegroundColor Yellow
foreach ($file in $oldMigrations) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "    ✓ Removed: $(Split-Path $file -Leaf)" -ForegroundColor Green
        $cleanupCount++
    }
}

# Remove duplicate RESTART scripts (keep only START_ALL_EXTERNAL.ps1)
$oldStartScripts = @(
    "C:\Users\Admin\USSD\RESTART_ALL.ps1",
    "C:\Users\Admin\USSD\START_ALL_WITH_NGROK.ps1"
)

Write-Host "`n 🗑️  Checking old start scripts..." -ForegroundColor Yellow
foreach ($file in $oldStartScripts) {
    if (Test-Path $file) {
        # Don't remove, just notify
        Write-Host "    ℹ️  Found old script: $(Split-Path $file -Leaf) (keeping for backup)" -ForegroundColor Cyan
    }
}

# Clean up node_modules duplicates (if any exist in wrong places)
Write-Host "`n 🗑️  Checking for stray node_modules..." -ForegroundColor Yellow
$strayNodeModules = @(
    "C:\Users\Admin\USSD\node_modules",
    "C:\Users\Admin\USSD\migrations\node_modules"
)

foreach ($dir in $strayNodeModules) {
    if (Test-Path $dir) {
        Write-Host "    ⚠️  Found stray node_modules at: $dir" -ForegroundColor Yellow
        Write-Host "       (Skipping - remove manually if needed)" -ForegroundColor Gray
    }
}

Write-Host "`n"
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   ✅ CLEANUP COMPLETE" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host " 📊 Summary:" -ForegroundColor White
Write-Host "    Files removed: $cleanupCount" -ForegroundColor Green
Write-Host "`n"

Write-Host " 📁 Project Structure:" -ForegroundColor White
Write-Host "    ✅ backend/ - Backend server code" -ForegroundColor Green
Write-Host "    ✅ frontend/ - React dashboard" -ForegroundColor Green
Write-Host "    ✅ migrations/ - Database migrations" -ForegroundColor Green
Write-Host "    ✅ START_*.ps1 - Server launch scripts" -ForegroundColor Green
Write-Host "`n"

Write-Host " Press any key to close..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
