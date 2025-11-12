Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " COMPLETE SYSTEM RESTART" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

# Stop all servers (aggressive cleanup)
Write-Host "1. Stopping all servers..." -ForegroundColor Yellow

# Kill anything bound to port 4000 (old backend)
try {
    $conns = Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            try { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
} catch {}

# Kill any node and cloudflared trees
cmd /c "taskkill /F /IM node.exe /T >NUL 2>&1"
cmd /c "taskkill /F /IM cloudflared.exe /T >NUL 2>&1"

# Close any stale backend windows by title
Get-Process | Where-Object { $_.MainWindowTitle -like '*VOO BACKEND*' } | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 3
Write-Host "   ✅ Server cleanup completed`n" -ForegroundColor Green

# Start backend (MAIN SERVER)
Write-Host "2. Starting backend (SERVER)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' SERVER' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; cd C:\Users\Admin\USSD\backend; node src\index.js"
Start-Sleep -Seconds 5

# Check backend
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 5
    Write-Host "   ✅ Backend is ONLINE" -ForegroundColor Green
    if ($health.databases) {
        Write-Host "   - PostgreSQL: $($health.databases.postgresql)" -ForegroundColor White
        Write-Host "   - MongoDB: $($health.databases.mongodb)" -ForegroundColor White
    }
    Write-Host "" -ForegroundColor White
} catch {
    Write-Host "   ⚠️ Backend starting... (health check will be available shortly)`n" -ForegroundColor Yellow
}

# Start frontend
Write-Host "3. Starting frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' VOO FRONTEND DASHBOARD' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; cd C:\Users\Admin\USSD\frontend; npm run dev"
Start-Sleep -Seconds 3
Write-Host "   ✅ Frontend starting...`n" -ForegroundColor Green

# Start tunnel
Write-Host "4. Starting Cloudflare tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' CLOUDFLARE TUNNEL' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; & `$env:USERPROFILE\cloudflared.exe tunnel --url http://localhost:4000"
Start-Sleep -Seconds 5
Write-Host "   ✅ Tunnel starting...`n" -ForegroundColor Green

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " ALL SYSTEMS STARTED" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "What to do next:`n" -ForegroundColor Yellow
Write-Host "1. Look at the Cloudflare Tunnel window" -ForegroundColor White
Write-Host "2. Copy the URL (https://xxxx.trycloudflare.com)" -ForegroundColor White
Write-Host "3. Add /ussd to the end" -ForegroundColor White
Write-Host "4. Update in Africas Talking dashboard" -ForegroundColor White
Write-Host "5. Test in simulator`n" -ForegroundColor White

Write-Host " To test backend health:" -ForegroundColor Cyan
Write-Host "Invoke-RestMethod http://localhost:4000/health`n" -ForegroundColor White

Write-Host "================================================`n" -ForegroundColor Cyan
