# ============================================
#  VOO KYAMATU - DEVELOPMENT MODE
#  Auto-Restart on File Changes
# ============================================
#  Features:
#  - Backend auto-restarts when you edit src/ or db/ files
#  - Frontend has Hot Module Replacement (instant updates)
#  - Ngrok tunnel stays running
# ============================================

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  VOO KYAMATU - DEVELOPMENT MODE" -ForegroundColor Green
Write-Host "  Auto-Restart Enabled ⚡" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1) Clean up any existing processes
Write-Host "[1/4] Cleaning up old processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null | Out-Null
taskkill /F /IM ngrok.exe 2>$null | Out-Null
Start-Sleep 2
Write-Host "      ✓ Done" -ForegroundColor Green

# 2) Start Backend with Nodemon (auto-restart)
Write-Host ""
Write-Host "[2/4] Starting Backend with Auto-Restart..." -ForegroundColor Yellow
Write-Host "      📂 Watching: src/, db/" -ForegroundColor DarkGray
Write-Host "      🔄 Auto-restarts on file changes" -ForegroundColor DarkGray
$backendPath = "C:\Users\Admin\USSD\backend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; Write-Host '🚀 Backend Server - Development Mode' -ForegroundColor Cyan; Write-Host 'Auto-restart enabled. Edit files and save to see changes!' -ForegroundColor Green; Write-Host ''; `$env:NODE_ENV='development'; `$env:PORT='4000'; npm run dev"
) -WindowStyle Normal
Start-Sleep 4
Write-Host "      ✓ Backend running with nodemon" -ForegroundColor Green

# 3) Start Frontend with Vite HMR (instant updates)
Write-Host ""
Write-Host "[3/4] Starting Frontend with Hot Reload..." -ForegroundColor Yellow
Write-Host "      🔥 Hot Module Replacement enabled" -ForegroundColor DarkGray
Write-Host "      ⚡ Instant updates on save" -ForegroundColor DarkGray
$frontendPath = "C:\Users\Admin\USSD\frontend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendPath'; Write-Host '🎨 Admin Dashboard - Development Mode' -ForegroundColor Cyan; Write-Host 'Hot reload enabled. Your changes appear instantly!' -ForegroundColor Green; Write-Host ''; npm run dev"
) -WindowStyle Normal
Start-Sleep 4
Write-Host "      ✓ Frontend running with Vite HMR" -ForegroundColor Green

# 4) Start Ngrok Tunnel
Write-Host ""
Write-Host "[4/4] Starting Ngrok Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Write-Host '🌐 Ngrok Public Tunnel' -ForegroundColor Cyan; Write-Host 'Exposing port 4000 to the internet...' -ForegroundColor Green; Write-Host ''; ngrok http 4000"
) -WindowStyle Normal
Start-Sleep 6
Write-Host "      ✓ Ngrok tunnel active" -ForegroundColor Green

# 5) Display Status
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DEVELOPMENT SERVERS RUNNING ✓" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan

Start-Sleep 2

# Test services
Write-Host ""
Write-Host "  📡 Backend API:" -ForegroundColor White
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 3
    Write-Host "     ✓ http://localhost:4000 - ACTIVE" -ForegroundColor Green
    Write-Host "     🔄 Auto-restarts when you edit src/ or db/ files" -ForegroundColor DarkGray
} catch {
    Write-Host "     ⏳ Starting... (wait 5 seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  🎨 Admin Dashboard:" -ForegroundColor White
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "     ✓ http://localhost:5173 - ACTIVE" -ForegroundColor Green
    Write-Host "     ⚡ Hot reload enabled - changes appear instantly" -ForegroundColor DarkGray
} catch {
    Write-Host "     ⏳ Starting... (wait 5 seconds)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  🌐 Ngrok Public URL:" -ForegroundColor White
try {
    $api = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3
    $url = ($api.tunnels | Where-Object {$_.proto -eq 'https'}).public_url
    Write-Host "     ✓ $url" -ForegroundColor Green
    Write-Host ""
    Write-Host "  📱 Africa's Talking Webhook:" -ForegroundColor Cyan
    Write-Host "     ${url}/ussd" -ForegroundColor White
} catch {
    Write-Host "     ⏳ Check ngrok window for URL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  WHAT HAPPENS NOW:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🔄 BACKEND AUTO-RESTART:" -ForegroundColor White
Write-Host "     • Edit any file in backend/src/ or backend/db/" -ForegroundColor DarkGray
Write-Host "     • Save the file" -ForegroundColor DarkGray
Write-Host "     • Server automatically restarts (1 second delay)" -ForegroundColor DarkGray
Write-Host "     • Your changes are live!" -ForegroundColor Green
Write-Host ""
Write-Host "  ⚡ FRONTEND HOT RELOAD:" -ForegroundColor White
Write-Host "     • Edit any React component in frontend/src/" -ForegroundColor DarkGray
Write-Host "     • Save the file" -ForegroundColor DarkGray
Write-Host "     • Browser updates INSTANTLY (no refresh!)" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 PUBLIC ACCESS:" -ForegroundColor White
Write-Host "     • Ngrok tunnel stays running continuously" -ForegroundColor DarkGray
Write-Host "     • Configure AT Sandbox with the webhook URL above" -ForegroundColor DarkGray
Write-Host "     • Test USSD from any phone!" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  USEFUL COMMANDS:" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  In Backend terminal:" -ForegroundColor White
Write-Host "     rs + Enter       Manually restart backend" -ForegroundColor DarkGray
Write-Host "     Ctrl+C           Stop backend" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Monitor:" -ForegroundColor White
Write-Host "     http://localhost:4000/health   Health check" -ForegroundColor Cyan
Write-Host "     http://localhost:4000/metrics  System stats" -ForegroundColor Cyan
Write-Host "     http://localhost:4040          Ngrok dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Stop All:" -ForegroundColor White
Write-Host "     .\STOP_ALL.ps1                 Stop all services" -ForegroundColor Red
Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🎯 START CODING!" -ForegroundColor Green
Write-Host "     Your changes will automatically apply!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to exit monitoring (servers keep running)..." -ForegroundColor DarkGray
Write-Host ""

# Keep monitoring health
try {
    while ($true) {
        Start-Sleep 30
        # Silent health check
        try {
            Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 2 | Out-Null
        } catch {
            # Backend might be restarting due to file changes, that's OK
        }
    }
} finally {
    Write-Host ""
    Write-Host "Monitoring stopped. Servers are still running!" -ForegroundColor Yellow
    Write-Host "Use .\STOP_ALL.ps1 to stop all services." -ForegroundColor Yellow
}
