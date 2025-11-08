# START_CLOUDFLARE.ps1 - Run Cloudflare tunnel in external terminal
# This terminal will stay open until you close it manually

Write-Host "`n" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   STARTING CLOUDFLARE TUNNEL" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

Write-Host " ☁️  Cloudflare Tunnel Configuration:" -ForegroundColor White
Write-Host "    Local Port: 4000 (Backend)" -ForegroundColor Gray
Write-Host "    Protocol: HTTP" -ForegroundColor Gray
Write-Host "    Purpose: Backup USSD Callback URL" -ForegroundColor Gray
Write-Host "`n"

Write-Host " 🔧 Starting tunnel..." -ForegroundColor Yellow
Write-Host "`n"

# Run cloudflared
cloudflared tunnel --url http://localhost:4000

Write-Host "`n"
Write-Host " ⚠️  Tunnel stopped. Press any key to close this window..." -ForegroundColor Red
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
