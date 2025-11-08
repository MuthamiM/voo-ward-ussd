# START_BACKEND.ps1 - Run backend server in external terminal
# This terminal will stay open until you close it manually

Write-Host "`n" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   STARTING BACKEND SERVER" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host " 📡 Backend Server Configuration:" -ForegroundColor White
Write-Host "    Port: 4000" -ForegroundColor Gray
Write-Host "    Mode: Development" -ForegroundColor Gray
Write-Host "    Database: PostgreSQL (localhost:5432)" -ForegroundColor Gray
Write-Host "`n"

Write-Host " 🔧 Starting server..." -ForegroundColor Yellow
Write-Host "`n"

# Set working directory
Set-Location "C:\Users\Admin\USSD\backend"

# Set environment variable
$env:NODE_ENV = "development"

# Run the server
npm start

Write-Host "`n"
Write-Host " ⚠️  Server stopped. Press any key to close this window..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
