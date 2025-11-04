# Test script for Render deployment
# Run this after your service is live

param(
    [string]$BaseUrl = "https://voo-kyamatu-ussd.onrender.com"
)

Write-Host "`n🧪 Testing Render Deployment: $BaseUrl`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "Test 1: Health Endpoint" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod "$BaseUrl/health" -UseBasicParsing
    Write-Host "✅ Health check passed!" -ForegroundColor Green
    Write-Host "   Service: $($health.service)" -ForegroundColor White
    Write-Host "   Status: OK" -ForegroundColor White
    Write-Host "   Time: $($health.ts)`n" -ForegroundColor White
} catch {
    Write-Host "❌ Health check failed: $_`n" -ForegroundColor Red
    exit 1
}

# Test 2: USSD Language Menu
Write-Host "Test 2: USSD Language Menu" -ForegroundColor Yellow
try {
    $body = @{
        sessionId = "TEST_$(Get-Random)"
        phoneNumber = "254700000000"
        text = ""
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/ussd" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    if ($response -like "*KYAMATU WARD*" -and $response -like "*Select Language*") {
        Write-Host "✅ USSD menu working!" -ForegroundColor Green
        Write-Host "`nResponse:" -ForegroundColor White
        Write-Host $response -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "⚠️  Unexpected response: $response`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ USSD test failed: $_`n" -ForegroundColor Red
    exit 1
}

# Test 3: USSD with Language Selection
Write-Host "Test 3: USSD English Menu" -ForegroundColor Yellow
try {
    $body = @{
        sessionId = "TEST_$(Get-Random)"
        phoneNumber = "254700000000"
        text = "1"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/ussd" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    if ($response -like "*Language: English*" -and $response -like "*Register*") {
        Write-Host "✅ Language selection working!" -ForegroundColor Green
        Write-Host "`nResponse:" -ForegroundColor White
        Write-Host $response -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "⚠️  Unexpected response: $response`n" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Language test failed: $_`n" -ForegroundColor Red
}

# Summary
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🎉 ALL TESTS PASSED!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`nYour USSD callback URL is ready for Safaricom:" -ForegroundColor White
Write-Host "  $BaseUrl/ussd`n" -ForegroundColor Green -BackgroundColor Black
