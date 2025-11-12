# AFRICA'S TALKING SETUP GUIDE
# How to get your system working with Africa's Talking

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " AFRICA'S TALKING TROUBLESHOOTING" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

# Step 1: Check backend
Write-Host "📍 Step 1: Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 3
    Write-Host "   ✅ Backend is ONLINE" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend is OFFLINE" -ForegroundColor Red
    Write-Host "   Run: cd C:\Users\Admin\USSD\backend ; node src\index.js`n" -ForegroundColor White
    exit
}

# Step 2: Check tunnel
Write-Host "`n📍 Step 2: Checking Cloudflare tunnel..." -ForegroundColor Yellow
$tunnelProcs = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($tunnelProcs) {
    Write-Host "   ✅ Tunnel is RUNNING" -ForegroundColor Green
} else {
    Write-Host "   ❌ Tunnel is NOT running" -ForegroundColor Red
    Write-Host "   Starting tunnel now...`n" -ForegroundColor White
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$env:USERPROFILE\cloudflared.exe' tunnel --url http://localhost:4000"
    Write-Host "   ⏳ Waiting for tunnel to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
}

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " WHAT TO DO NEXT" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "1. Look at the VOO-Tunnel PowerShell window" -ForegroundColor White
Write-Host "   (It should have a green title bar)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Find the line that says:" -ForegroundColor White
Write-Host "   https://xxxxxx-xxxxx-xxxxx-xxxxx.trycloudflare.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Copy that FULL URL" -ForegroundColor White
Write-Host ""
Write-Host "4. Go to Africa's Talking Dashboard:" -ForegroundColor White
Write-Host "   https://account.africastalking.com/apps/sandbox/ussd/numbers" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Find your USSD code: *384*8481#" -ForegroundColor White
Write-Host ""
Write-Host "6. Update the Callback URL to:" -ForegroundColor White
Write-Host "   https://YOUR-TUNNEL-URL/ussd" -ForegroundColor Yellow
Write-Host "   (Add /ussd at the end!)" -ForegroundColor Gray
Write-Host ""
Write-Host "7. Click Save" -ForegroundColor White
Write-Host ""
Write-Host "8. Test in simulator:" -ForegroundColor White
Write-Host "   https://simulator.africastalking.com:1555/" -ForegroundColor Cyan
Write-Host ""

Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "⚠️  IMPORTANT:" -ForegroundColor Red
Write-Host "   - The tunnel URL changes every time you restart!" -ForegroundColor White
Write-Host "   - You must update Africa's Talking callback URL each time" -ForegroundColor White
Write-Host "   - Always add /ussd at the end of the URL`n" -ForegroundColor White

Write-Host "💡 TIP: Test the callback URL first:" -ForegroundColor Yellow
Write-Host ""
$testUrl = Read-Host "   Enter your tunnel URL (or press Enter to skip)"
if ($testUrl) {
    if (-not $testUrl.EndsWith('/ussd')) {
        $testUrl = $testUrl.TrimEnd('/') + '/ussd'
    }
    Write-Host "`n   Testing: $testUrl`n" -ForegroundColor Cyan
    try {
        $body = @{
            sessionId = 'test123'
            phoneNumber = '+254712345678'
            text = ''
        }
        $response = Invoke-RestMethod -Uri $testUrl -Method POST -Body $body -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 5
        Write-Host "   ✅ Callback URL is working!" -ForegroundColor Green
        Write-Host "   Response: $response`n" -ForegroundColor White
    } catch {
        Write-Host "   ❌ Callback URL failed!" -ForegroundColor Red
        Write-Host "   Error: $_`n" -ForegroundColor White
    }
}

Write-Host "================================================`n" -ForegroundColor Cyan
