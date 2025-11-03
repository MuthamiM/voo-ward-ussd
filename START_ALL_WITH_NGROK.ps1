Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " START ALL SERVERS (INCLUDING NGROK)" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

# Check what's already running
Write-Host "Checking current status..." -ForegroundColor Yellow
$node = Get-Process node -ErrorAction SilentlyContinue
$cloudflared = Get-Process cloudflared -ErrorAction SilentlyContinue
$ngrok = Get-Process ngrok -ErrorAction SilentlyContinue

if ($node) {
    Write-Host "  Backend: Already running (keeping it)" -ForegroundColor Green
} else {
    Write-Host "  Backend: Starting..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' VOO BACKEND - OPTIMIZED' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; cd C:\Users\Admin\USSD\backend; node src\index.js"
    Start-Sleep -Seconds 5
}

if ($cloudflared) {
    Write-Host "  Cloudflare: Already running (keeping it)" -ForegroundColor Green
} else {
    Write-Host "  Cloudflare: Starting..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' CLOUDFLARE TUNNEL (BACKUP)' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; & `$env:USERPROFILE\cloudflared.exe tunnel --url http://localhost:4000"
    Start-Sleep -Seconds 3
}

Write-Host "  Frontend: Starting..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' VOO FRONTEND DASHBOARD' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; cd C:\Users\Admin\USSD\frontend; npm run dev"
Start-Sleep -Seconds 2

if ($ngrok) {
    Write-Host "  Ngrok: Already running (keeping it)" -ForegroundColor Green
} else {
    Write-Host "  Ngrok: Starting..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' NGROK TUNNEL (PRIMARY)' -ForegroundColor Green; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ' Tunneling port 4000 to the internet' -ForegroundColor White; Write-Host ' Dashboard: http://localhost:4040' -ForegroundColor White; Write-Host '=======================================' -ForegroundColor Cyan; Write-Host ''; ngrok http 4000"
    Start-Sleep -Seconds 5
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " ALL SERVERS STARTED" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

# Verify backend
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 3
    Write-Host "Backend Status: ONLINE" -ForegroundColor Green
    Write-Host "  Members: $($health.counts.members)" -ForegroundColor White
    Write-Host "  Issues: $($health.counts.issues)`n" -ForegroundColor White
} catch {
    Write-Host "Backend Status: FAILED TO START`n" -ForegroundColor Red
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " GET YOUR NGROK CALLBACK URL" -ForegroundColor Yellow
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "Run this command to get your callback URL:" -ForegroundColor White
Write-Host "  .\GET_NGROK_URL.ps1`n" -ForegroundColor Green

Write-Host "Or manually:" -ForegroundColor White
Write-Host "  1. Look at NGROK window for URL" -ForegroundColor White
Write-Host "  2. Copy the HTTPS URL (e.g., https://abc.ngrok-free.dev)" -ForegroundColor White
Write-Host "  3. Add /ussd to the end" -ForegroundColor White
Write-Host "  4. Update in Africa's Talking dashboard`n" -ForegroundColor White

Write-Host "Ngrok Dashboard: http://localhost:4040" -ForegroundColor Cyan
Write-Host "  (View requests, inspect traffic, get URL)`n" -ForegroundColor Gray

Write-Host "================================================`n" -ForegroundColor Cyan
