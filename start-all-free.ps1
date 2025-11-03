# Kyamatu Ward - Start All Free Alternatives
# Run this script to start ALL services at once

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 KYAMATU WARD FREE USSD SYSTEM" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootPath = "C:\Users\Admin\USSD"

# Check if backend exists
if (-Not (Test-Path "$rootPath\backend")) {
    Write-Host "❌ Backend folder not found!" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is running
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService -and $pgService.Status -eq "Running") {
    Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "⚠️  PostgreSQL may not be running" -ForegroundColor Yellow
}
Write-Host ""

# Function to check if port is in use
function Test-Port {
    param($port)
    $connection = Test-NetConnection -ComputerName localhost -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    return $connection
}

# Check if ports are available
Write-Host "🔍 Checking ports..." -ForegroundColor Yellow
if (Test-Port 4000) {
    Write-Host "⚠️  Port 4000 is already in use (Backend)" -ForegroundColor Yellow
}
if (Test-Port 5173) {
    Write-Host "⚠️  Port 5173 is already in use (Frontend)" -ForegroundColor Yellow
}
if (Test-Port 4001) {
    Write-Host "⚠️  Port 4001 is already in use (WhatsApp Bridge)" -ForegroundColor Yellow
}
if (Test-Port 8080) {
    Write-Host "⚠️  Port 8080 is already in use (Web Simulator)" -ForegroundColor Yellow
}
Write-Host ""

# Start services
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 STARTING SERVICES..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend
Write-Host "1️⃣  Starting Backend (Port 4000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootPath\backend'; Write-Host '🔧 BACKEND SERVER' -ForegroundColor Green; npm start"
Start-Sleep -Seconds 2

# 2. Frontend
Write-Host "2️⃣  Starting Frontend (Port 5173)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootPath\frontend'; Write-Host '🎨 FRONTEND DASHBOARD' -ForegroundColor Green; npm run dev"
Start-Sleep -Seconds 2

# 3. Telegram Bot (if exists)
if (Test-Path "$rootPath\telegram-bot") {
    if (Test-Path "$rootPath\telegram-bot\.env") {
        Write-Host "3️⃣  Starting Telegram Bot..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootPath\telegram-bot'; Write-Host '🤖 TELEGRAM BOT' -ForegroundColor Green; npm start"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "⚠️  Telegram bot .env not configured (skipping)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Telegram bot not installed (skipping)" -ForegroundColor Yellow
}

# 4. WhatsApp Bridge (if exists)
if (Test-Path "$rootPath\whatsapp-bridge") {
    Write-Host "4️⃣  Starting WhatsApp Bridge (Port 4001)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootPath\whatsapp-bridge'; Write-Host '💬 WHATSAPP BRIDGE' -ForegroundColor Green; npm start"
    Start-Sleep -Seconds 2
} else {
    Write-Host "⚠️  WhatsApp bridge not installed (skipping)" -ForegroundColor Yellow
}

# 5. Web Simulator (if Python available)
if (Test-Path "$rootPath\web-simulator") {
    $pythonExists = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonExists) {
        Write-Host "5️⃣  Starting Web Simulator (Port 8080)..." -ForegroundColor Cyan
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootPath\web-simulator'; Write-Host '🌐 WEB SIMULATOR' -ForegroundColor Green; python -m http.server 8080"
        Start-Sleep -Seconds 2
    } else {
        Write-Host "⚠️  Python not found - Web simulator needs Python (skipping)" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  Web simulator not found (skipping)" -ForegroundColor Yellow
}

# 6. Cloudflared (optional, for WhatsApp)
$cloudflaredExists = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cloudflaredExists -and (Test-Path "$rootPath\whatsapp-bridge")) {
    Write-Host "6️⃣  Starting Cloudflared Tunnel (for WhatsApp)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '☁️  CLOUDFLARED TUNNEL' -ForegroundColor Green; cloudflared tunnel --url http://localhost:4001"
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ ALL SERVICES STARTED!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Access Points:" -ForegroundColor Yellow
Write-Host "  • Backend:        http://localhost:4000" -ForegroundColor White
Write-Host "  • Frontend:       http://localhost:5173" -ForegroundColor White
Write-Host "  • Web Simulator:  http://localhost:8080" -ForegroundColor White
Write-Host "  • WhatsApp:       Check cloudflared terminal for URL" -ForegroundColor White
Write-Host "  • Telegram:       Search @KyamatuWardBot in Telegram app" -ForegroundColor White
Write-Host ""
Write-Host "📊 Dashboard Login:" -ForegroundColor Yellow
Write-Host "  • Default Admin:  admin@kyamatu.go.ke / admin123" -ForegroundColor White
Write-Host ""
Write-Host "🛠️  To stop all services, close all PowerShell windows" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 System ready for 5000+ Kyamatu Ward voters!" -ForegroundColor Green
Write-Host ""
