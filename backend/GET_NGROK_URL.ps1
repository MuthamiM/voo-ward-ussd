# Get Ngrok Callback URL
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host " GET NGROK CALLBACK URL" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if ngrok is running
$ngrokProc = Get-Process ngrok -ErrorAction SilentlyContinue
if (-not $ngrokProc) {
    Write-Host "ERROR: Ngrok is not running!`n" -ForegroundColor Red
    Write-Host "Start ngrok with:" -ForegroundColor Yellow
    Write-Host "  ngrok http 4000`n" -ForegroundColor White
    exit
}

Write-Host "Ngrok is running. Fetching URL...`n" -ForegroundColor Green

# Get ngrok URL from API
try {
    $ngrokApi = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
    $publicUrl = $ngrokApi.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1 -ExpandProperty public_url
    
    if ($publicUrl) {
        $callbackUrl = "$publicUrl/ussd"
        
        Write-Host "========================================" -ForegroundColor Green
        Write-Host " NGROK CALLBACK URL" -ForegroundColor Yellow
        Write-Host "========================================`n" -ForegroundColor Green
        
        Write-Host $callbackUrl -ForegroundColor Cyan
        Write-Host ""
        
        # Copy to clipboard
        Set-Clipboard -Value $callbackUrl
        Write-Host "Copied to clipboard!" -ForegroundColor Green
        
        # Save to file
        $callbackUrl | Out-File -FilePath "C:\Users\Admin\USSD\CURRENT_NGROK_URL.txt" -Encoding utf8 -Force
        Write-Host "Saved to: CURRENT_NGROK_URL.txt`n" -ForegroundColor Gray
        
        # Test the URL
        Write-Host "Testing connection..." -ForegroundColor Yellow
        try {
            $health = Invoke-RestMethod -Uri "$publicUrl/health" -TimeoutSec 10
            Write-Host "  Backend: REACHABLE" -ForegroundColor Green
            Write-Host "  Members: $($health.counts.members)" -ForegroundColor White
            Write-Host "  Status: $($health.ussd)`n" -ForegroundColor White
        } catch {
            Write-Host "  WARNING: Could not reach backend through ngrok" -ForegroundColor Yellow
            Write-Host "  Error: $($_.Exception.Message)`n" -ForegroundColor Red
        }
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host " UPDATE AFRICA'S TALKING" -ForegroundColor Yellow
        Write-Host "========================================`n" -ForegroundColor Cyan
        
        Write-Host "1. Go to: https://account.africastalking.com/apps/sandbox/ussd/numbers" -ForegroundColor White
        Write-Host "2. Find USSD code: *384*8481#" -ForegroundColor White
        Write-Host "3. Update Callback URL with:" -ForegroundColor White
        Write-Host "   $callbackUrl" -ForegroundColor Yellow
        Write-Host "4. Save and test in simulator`n" -ForegroundColor White
        
        Write-Host "WHY NGROK IS BETTER:" -ForegroundColor Cyan
        Write-Host "  - More stable than Cloudflare free tunnels" -ForegroundColor Green
        Write-Host "  - Better compatibility with Africa's Talking" -ForegroundColor Green
        Write-Host "  - Same URL until you restart ngrok" -ForegroundColor Green
        Write-Host "  - Built-in web interface at http://localhost:4040`n" -ForegroundColor Green
        
        Write-Host "========================================`n" -ForegroundColor Cyan
        
    } else {
        Write-Host "ERROR: No HTTPS tunnel found`n" -ForegroundColor Red
        Write-Host "Make sure ngrok is running with:" -ForegroundColor Yellow
        Write-Host "  ngrok http 4000`n" -ForegroundColor White
    }
    
} catch {
    Write-Host "ERROR: Could not connect to ngrok API`n" -ForegroundColor Red
    Write-Host "Make sure ngrok is running and try again.`n" -ForegroundColor Yellow
    Write-Host "Or manually check ngrok window for the URL.`n" -ForegroundColor White
}
