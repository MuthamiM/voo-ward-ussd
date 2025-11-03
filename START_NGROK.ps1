# START_NGROK.ps1 - Run ngrok tunnel in external terminal
# This terminal will stay open until you close it manually

Write-Host "`n" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   STARTING NGROK TUNNEL" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host " 🌐 Ngrok Tunnel Configuration:" -ForegroundColor White
Write-Host "    Local Port: 4000 (Backend)" -ForegroundColor Gray
Write-Host "    Protocol: HTTP" -ForegroundColor Gray
Write-Host "    Purpose: USSD Callback URL" -ForegroundColor Gray
Write-Host "`n"

Write-Host " 🔧 Starting tunnel..." -ForegroundColor Yellow
Write-Host "`n"

# Run ngrok
ngrok http 4000

Write-Host "`n"
Write-Host " ⚠️  Tunnel stopped. Press any key to close this window..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
