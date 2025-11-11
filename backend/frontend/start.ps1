# Voo Kyamatu Frontend Startup Script (PowerShell)

Write-Host ""
Write-Host "========================================"
Write-Host " VOO KYAMATU FRONTEND STARTUP"
Write-Host "========================================"
Write-Host ""

# Check if port 5173 is in use
$portCheck = netstat -ano | Select-String ":5173"
if ($portCheck) {
    Write-Host "[ERROR] Port 5173 is already in use!" -ForegroundColor Red
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

Write-Host "[INFO] Starting frontend server..." -ForegroundColor Green
Write-Host "[INFO] Port: 5173" -ForegroundColor Cyan
Write-Host "[INFO] URL: http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host ""

# Start the server
npm run dev
