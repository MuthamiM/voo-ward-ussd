# ============================================
#  VOO KYAMATU - STOP ALL SERVERS
# ============================================

Write-Host ""
Write-Host "Stopping all services..." -ForegroundColor Yellow
Write-Host ""

# Stop Node processes (backend + frontend)
Write-Host "  Stopping Backend & Frontend..." -ForegroundColor White
taskkill /F /IM node.exe 2>$null | Out-Null

# Stop Ngrok
Write-Host "  Stopping Ngrok tunnel..." -ForegroundColor White
taskkill /F /IM ngrok.exe 2>$null | Out-Null

Start-Sleep 2

Write-Host ""
Write-Host "  All services stopped." -ForegroundColor Green
Write-Host ""
