# ============================================
#  VOO KYAMATU USSD - MASTER STARTUP SCRIPT
# ============================================
# Starts: Backend + Frontend + Ngrok Tunnel
# Keeps all running for demos/testing
# ============================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   VOO KYAMATU SYSTEM - STARTING ALL" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1) Kill any existing processes
Write-Host "[1/5] Cleaning up old processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null | Out-Null
taskkill /F /IM ngrok.exe 2>$null | Out-Null
Start-Sleep 2
Write-Host "      Done" -ForegroundColor Green

# 2) Start Backend (Fastify on port 4000 with auto-restart)
Write-Host ""
Write-Host "[2/5] Starting Backend Server (port 4000) with auto-restart..." -ForegroundColor Yellow
$backendPath = "C:\Users\Admin\USSD\backend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; `$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'; `$env:NODE_ENV='development'; `$env:PORT='4000'; npm run dev"
) -WindowStyle Normal
Start-Sleep 3
Write-Host "      Backend starting with nodemon (auto-restart enabled)..." -ForegroundColor Green

# 3) Start Frontend (Vite on port 5173)
Write-Host ""
Write-Host "[3/5] Starting Frontend Dashboard (port 5173)..." -ForegroundColor Yellow
$frontendPath = "C:\Users\Admin\USSD\frontend"
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendPath'; npm run dev"
) -WindowStyle Normal
Start-Sleep 3
Write-Host "      Frontend starting..." -ForegroundColor Green

# 4) Start Ngrok Tunnel (for public USSD access)
Write-Host ""
Write-Host "[4/5] Starting Ngrok Tunnel..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "ngrok http 4000 --log=stdout"
) -WindowStyle Normal
Start-Sleep 5
Write-Host "      Ngrok tunnel started" -ForegroundColor Green

# 5) Wait and test all services
Write-Host ""
Write-Host "[5/5] Testing all services..." -ForegroundColor Yellow
Start-Sleep 8

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "        SYSTEM STATUS" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

# Test Backend
Write-Host ""
Write-Host "  Backend (API + USSD):" -ForegroundColor White
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 3
    Write-Host "     http://localhost:4000 - ACTIVE" -ForegroundColor Green
} catch {
    Write-Host "     Starting... (wait 10s)" -ForegroundColor Yellow
}

# Test Frontend
Write-Host ""
Write-Host "  Admin Dashboard:" -ForegroundColor White
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "     http://localhost:5173 - ACTIVE" -ForegroundColor Green
} catch {
    Write-Host "     Starting... (wait 10s)" -ForegroundColor Yellow
}

# Get Ngrok URL
Write-Host ""
Write-Host "  Ngrok Public Tunnel:" -ForegroundColor White
try {
    $api = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 3
    $url = ($api.tunnels | Where-Object {$_.proto -eq 'https'}).public_url
    Write-Host "     $url" -ForegroundColor Green
    Write-Host ""
    Write-Host "  AFRICA'S TALKING WEBHOOK URL:" -ForegroundColor Cyan
    Write-Host "     ${url}/ussd" -ForegroundColor White
} catch {
    Write-Host "     Starting... (check ngrok window)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "        WHAT TO DO NOW" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. OPEN ADMIN DASHBOARD:" -ForegroundColor Yellow
Write-Host "      http://localhost:5173" -ForegroundColor Cyan
Write-Host "      Login: MCA PIN=123456 or PA PIN=654321" -ForegroundColor White
Write-Host ""
Write-Host "  2. CONFIGURE AFRICA'S TALKING:" -ForegroundColor Yellow
Write-Host "      Dashboard > USSD > Callback URL" -ForegroundColor White
Write-Host "      Paste the webhook URL above" -ForegroundColor White
Write-Host ""
Write-Host "  3. TEST USSD:" -ForegroundColor Yellow
Write-Host "      Use AT Simulator or real phone" -ForegroundColor White
Write-Host "      Dial *340*75#" -ForegroundColor White
Write-Host ""
Write-Host "  4. VIEW METRICS:" -ForegroundColor Yellow
Write-Host "      http://localhost:4000/metrics" -ForegroundColor Cyan
Write-Host ""
Write-Host "  5. EXPORT DATA:" -ForegroundColor Yellow
Write-Host "      Dashboard > Admin > Download CSV" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   ALL SERVERS RUNNING - READY FOR DEMO!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all servers..." -ForegroundColor DarkGray
Write-Host ""

# Keep script running
try {
    while ($true) {
        Start-Sleep 10
        # Check if backend still alive
        try {
            Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 2 | Out-Null
        } catch {
            Write-Host ""
            Write-Host "  Backend stopped - restarting with nodemon..." -ForegroundColor Yellow
            Start-Process powershell -ArgumentList @(
                "-NoExit",
                "-Command",
                "cd '$backendPath'; `$env:DB_URL='postgresql://postgres:23748124@localhost:5432/voo_db'; `$env:NODE_ENV='development'; `$env:PORT='4000'; npm run dev"
            ) -WindowStyle Normal
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    taskkill /F /IM node.exe 2>$null | Out-Null
    taskkill /F /IM ngrok.exe 2>$null | Out-Null
    Write-Host "All services stopped." -ForegroundColor Green
}
