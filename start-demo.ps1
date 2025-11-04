# Voo Kyamatu - Live Demo Starter
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VOO KYAMATU - LIVE USSD DEMO" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
Write-Host "[1/3] Checking backend..." -ForegroundColor Cyan
$backend = Test-NetConnection -ComputerName 127.0.0.1 -Port 4000 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $backend) {
    Write-Host "      Starting backend server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\Admin\USSD\backend; .\start.ps1"
    Start-Sleep 5
} else {
    Write-Host "      Backend already running ✅" -ForegroundColor Green
}

# Check if frontend is running
Write-Host "[2/3] Checking frontend..." -ForegroundColor Cyan
$frontend = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $frontend) {
    Write-Host "      Starting frontend server..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\Users\Admin\USSD\frontend; .\start.ps1"
    Start-Sleep 5
} else {
    Write-Host "      Frontend already running ✅" -ForegroundColor Green
}

# Start cloudflared tunnel
Write-Host "[3/3] Starting public tunnel..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  ⚠️  COPY THE HTTPS URL BELOW" -ForegroundColor Yellow
Write-Host "  📋 Paste into Africa's Talking:" -ForegroundColor Yellow
Write-Host "     Dashboard → Sandbox → USSD Callback" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Check if cloudflared is installed
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "❌ cloudflared not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Download it now:" -ForegroundColor Yellow
    Write-Host "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use ngrok instead:" -ForegroundColor Yellow
    Write-Host "ngrok http 4000" -ForegroundColor Cyan
    Write-Host ""
    pause
    exit 1
}

# Start tunnel
cloudflared tunnel --url http://localhost:4000
