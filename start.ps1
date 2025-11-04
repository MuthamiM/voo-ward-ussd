# Voo Kyamatu Backend Startup Script (PowerShell)

Write-Host ""
Write-Host "========================================"
Write-Host " VOO KYAMATU BACKEND STARTUP"
Write-Host "========================================"
Write-Host ""

# Check if port 4000 is in use
$portCheck = netstat -ano | Select-String ":4000"
if ($portCheck) {
    Write-Host "[ERROR] Port 4000 is already in use!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To kill the process:" -ForegroundColor Yellow
    $portCheck | ForEach-Object {
        if ($_ -match "\s+(\d+)$") {
            Write-Host "  taskkill /F /PID $($matches[1])" -ForegroundColor Yellow
        }
    }
    Write-Host ""
    pause
    exit 1
}

# Change to backend directory
Set-Location C:\Users\Admin\USSD\backend

# Set environment variables
$env:DB_URL = 'postgresql://postgres:23748124@localhost:5432/voo_db'
$env:NODE_ENV = 'production'
$env:PORT = '4000'

Write-Host "[INFO] Starting backend server..." -ForegroundColor Green
Write-Host "[INFO] Working Directory: $PWD" -ForegroundColor Cyan
Write-Host "[INFO] Database: PostgreSQL (voo_db)" -ForegroundColor Cyan
Write-Host "[INFO] Port: 4000" -ForegroundColor Cyan
Write-Host "[INFO] Mode: PRODUCTION" -ForegroundColor Cyan
Write-Host ""

# Start the server
node src\index.js
