# Get Current Cloudflare Tunnel URL
# This script finds the active tunnel URL from the running process

Write-Host "`n🔍 Finding Cloudflare Tunnel URL...`n" -ForegroundColor Cyan

# Check if cloudflared is running
$process = Get-Process cloudflared -ErrorAction SilentlyContinue

if (-not $process) {
    Write-Host "❌ Cloudflare Tunnel is NOT running!`n" -ForegroundColor Red
    Write-Host "Start it first: C:\Users\Admin\USSD\START_ALL_SERVERS_OPTIMIZED.bat`n" -ForegroundColor Yellow
    exit
}

Write-Host "✅ Tunnel process found (PID: $($process.Id))`n" -ForegroundColor Green

# Try to find tunnel URL from recent PowerShell windows
$tunnelUrl = $null

# Method 1: Check if there's a log file or temp file
$tempLogPath = "$env:TEMP\cloudflared_tunnel.log"
if (Test-Path $tempLogPath) {
    $content = Get-Content $tempLogPath -ErrorAction SilentlyContinue
    $match = $content | Select-String -Pattern "https://[a-z0-9\-]+\.trycloudflare\.com" | Select-Object -Last 1
    if ($match) {
        $tunnelUrl = $match.Matches.Value
    }
}

# Method 2: Try to get from clipboard (if user just copied it)
if (-not $tunnelUrl) {
    Write-Host "💡 Attempting to detect tunnel URL...`n" -ForegroundColor Yellow
    Write-Host "Please look at your Cloudflare Tunnel window and find the URL.`n" -ForegroundColor White
    Write-Host "It looks like:" -ForegroundColor Gray
    Write-Host "   https://xxxxx-xxxxx-xxxxx.trycloudflare.com`n" -ForegroundColor Cyan
    
    Write-Host "Paste the tunnel URL here (without /ussd): " -ForegroundColor Yellow -NoNewline
    $tunnelUrl = Read-Host
    $tunnelUrl = $tunnelUrl.Trim()
}

if (-not $tunnelUrl) {
    Write-Host "`n❌ Could not find tunnel URL!`n" -ForegroundColor Red
    exit
}

# Ensure it's a valid URL
if ($tunnelUrl -notmatch "^https://") {
    $tunnelUrl = "https://" + $tunnelUrl
}

# Remove any trailing slashes
$tunnelUrl = $tunnelUrl.TrimEnd('/')

# Create the callback URL
$callbackUrl = "$tunnelUrl/ussd"

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          📡 CLOUDFLARE TUNNEL URL FOUND!               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "🌐 Tunnel URL:" -ForegroundColor Cyan
Write-Host "   $tunnelUrl`n" -ForegroundColor White

Write-Host "📱 Africa's Talking Callback URL:" -ForegroundColor Cyan
Write-Host "   $callbackUrl`n" -ForegroundColor Green

Write-Host "📋 COPIED TO CLIPBOARD!" -ForegroundColor Yellow
Set-Clipboard -Value $callbackUrl
Write-Host "   The callback URL is now in your clipboard.`n" -ForegroundColor White

Write-Host "🔧 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Go to: https://account.africastalking.com/apps/sandbox/ussd/numbers" -ForegroundColor White
Write-Host "   2. Find USSD code: *384*8481#" -ForegroundColor White
Write-Host "   3. Paste the callback URL (Ctrl+V)" -ForegroundColor White
Write-Host "   4. Click SAVE" -ForegroundColor White
Write-Host "   5. Test by dialing *384*8481# in simulator`n" -ForegroundColor White

# Test the URL
Write-Host "🧪 Testing tunnel connectivity..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Tunnel is WORKING! Backend is reachable.`n" -ForegroundColor Green
    Write-Host "   USSD Status: $($response.ussd)" -ForegroundColor White
    Write-Host "   Members: $($response.counts.members)`n" -ForegroundColor White
} catch {
    Write-Host "⚠️  Warning: Could not test tunnel (may take a moment to activate)`n" -ForegroundColor Yellow
    Write-Host "   Try updating Africa's Talking anyway.`n" -ForegroundColor Gray
}

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ Callback URL ready to use!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Save to a file for future reference
$tunnelUrl | Out-File -FilePath "C:\Users\Admin\USSD\CURRENT_TUNNEL_URL.txt" -Encoding UTF8
Write-Host "💾 Saved to: C:\Users\Admin\USSD\CURRENT_TUNNEL_URL.txt`n" -ForegroundColor Gray
