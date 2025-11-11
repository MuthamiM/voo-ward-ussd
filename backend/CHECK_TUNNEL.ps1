# Quick Check - Is your tunnel URL correct?

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " AFRICA'S TALKING QUICK FIX" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

# Check if backend is running
Write-Host "1️⃣  Checking backend..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -TimeoutSec 3
    Write-Host "   ✅ Backend is RUNNING`n" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Backend is NOT running!`n" -ForegroundColor Red
    Write-Host "   Start it: cd C:\Users\Admin\USSD\backend ; node src\index.js`n" -ForegroundColor White
    exit
}

# Check tunnel
Write-Host "2️⃣  Checking Cloudflare tunnel..." -ForegroundColor Yellow
$tunnel = Get-Process cloudflared -ErrorAction SilentlyContinue
if (-not $tunnel) {
    Write-Host "   ❌ Tunnel is NOT running!`n" -ForegroundColor Red
    Write-Host "   The tunnel URL in Africa's Talking is probably outdated.`n" -ForegroundColor White
    Write-Host "   Look at the VOO-Tunnel window for the current URL.`n" -ForegroundColor Yellow
    exit
}
Write-Host "   ✅ Tunnel is RUNNING`n" -ForegroundColor Green

# Test the known URL
Write-Host "3️⃣  Testing your Africa's Talking callback URL..." -ForegroundColor Yellow
$atUrl = "https://left-cancellation-distance-lenses.trycloudflare.com/ussd"
try {
    $body = "sessionId=test&phoneNumber=%2B254712345678&text="
    $response = Invoke-WebRequest -Uri $atUrl -Method POST -Body $body -ContentType "application/x-www-form-urlencoded" -TimeoutSec 5
    Write-Host "   ✅ Callback URL is WORKING!`n" -ForegroundColor Green
    Write-Host "   The problem might be:" -ForegroundColor Yellow
    Write-Host "   - Africa's Talking Sandbox server issues (their side)" -ForegroundColor White
    Write-Host "   - Try the simulator again in a few minutes" -ForegroundColor White
    Write-Host "   - Or check if you saved the callback URL correctly`n" -ForegroundColor White
} catch {
    Write-Host "   ❌ This URL is NOT working anymore!`n" -ForegroundColor Red
    Write-Host "   The tunnel URL has changed. You need to:`n" -ForegroundColor Yellow
    Write-Host "   Step 1: Look at the VOO-Tunnel PowerShell window" -ForegroundColor White
    Write-Host "   Step 2: Find the line with: https://xxxx-xxxx.trycloudflare.com" -ForegroundColor White
    Write-Host "   Step 3: Copy that URL and add /ussd at the end" -ForegroundColor White
    Write-Host "   Step 4: Update in Africa's Talking dashboard`n" -ForegroundColor White
}

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " COMMON ISSUES & SOLUTIONS" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Cyan

Write-Host "Issue: 'Network experiencing technical problems'" -ForegroundColor Yellow
Write-Host "Solutions:" -ForegroundColor White
Write-Host "  1. Tunnel URL changed - update in Africa's Talking" -ForegroundColor Gray
Write-Host "  2. Backend not responding - restart backend" -ForegroundColor Gray
Write-Host "  3. Africa's Talking sandbox issues - wait and retry" -ForegroundColor Gray
Write-Host "  4. Callback URL doesn't end with /ussd - fix it`n" -ForegroundColor Gray

Write-Host "To get your CURRENT tunnel URL:" -ForegroundColor Yellow
Write-Host "  - Look at VOO-Tunnel window (green title bar)" -ForegroundColor White
Write-Host "  - Copy the https://xxxx.trycloudflare.com URL" -ForegroundColor White
Write-Host "  - Add /ussd at the end" -ForegroundColor White
Write-Host "  - Update in Africa's Talking dashboard`n" -ForegroundColor White

Write-Host "================================================`n" -ForegroundColor Cyan

# Ask if they want to find the current URL
Write-Host "💡 TIP: The tunnel URL changes each time you restart!" -ForegroundColor Cyan
Write-Host "   Always check VOO-Tunnel window for the current URL`n" -ForegroundColor White
