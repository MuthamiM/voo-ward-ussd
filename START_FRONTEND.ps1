# START_FRONTEND.ps1 - Run frontend dashboard in external terminal
# This terminal will stay open until you close it manually

Write-Host "`n" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   STARTING FRONTEND DASHBOARD" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host " 🖥️  Frontend Dashboard Configuration:" -ForegroundColor White
Write-Host "    Port: 5173" -ForegroundColor Gray
Write-Host "    URL: http://localhost:5173" -ForegroundColor Gray
Write-Host "    Framework: React + Vite" -ForegroundColor Gray
Write-Host "`n"

Write-Host " 🔧 Starting dashboard..." -ForegroundColor Yellow
Write-Host "`n"

# Set working directory
Set-Location "C:\Users\Admin\USSD\frontend"

# Run the dev server
npm run dev

Write-Host "`n"
Write-Host " ⚠️  Dashboard stopped. Press any key to close this window..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
