# Quick Tunnel URL Helper
# Run this anytime to get your current callback URL

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       📡 GET CLOUDFLARE TUNNEL CALLBACK URL           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check if tunnel is running
if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Cloudflare Tunnel is NOT running!`n" -ForegroundColor Red
    Write-Host "Start servers first:`n" -ForegroundColor Yellow
    Write-Host "   C:\Users\Admin\USSD\START_ALL_SERVERS_OPTIMIZED.bat`n" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "✅ Tunnel is running!`n" -ForegroundColor Green

Write-Host "🔍 FIND YOUR TUNNEL URL:" -ForegroundColor Yellow
Write-Host "`n1. Look at your 'VOO-Tunnel' PowerShell window" -ForegroundColor White
Write-Host "2. Find this line:" -ForegroundColor White
Write-Host "   ╔════════════════════════════════════════════════╗" -ForegroundColor Gray
Write-Host "   ║  Your quick Tunnel has been created!           ║" -ForegroundColor Gray
Write-Host "   ║  Visit it at:                                  ║" -ForegroundColor Gray
Write-Host "   ║  https://xxxxx-xxxxx-xxxxx.trycloudflare.com   ║" -ForegroundColor Cyan
Write-Host "   ╚════════════════════════════════════════════════╝" -ForegroundColor Gray
Write-Host "`n3. Copy that URL (the https://xxxxx part)`n" -ForegroundColor White

Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "📋 Paste the tunnel URL here: " -ForegroundColor Yellow -NoNewline
$tunnelUrl = Read-Host

if ([string]::IsNullOrWhiteSpace($tunnelUrl)) {
    Write-Host "`n❌ No URL provided!`n" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

# Clean up the URL
$tunnelUrl = $tunnelUrl.Trim()
if ($tunnelUrl -notmatch "^https://") {
    $tunnelUrl = "https://" + $tunnelUrl
}
$tunnelUrl = $tunnelUrl.TrimEnd('/')

# Create callback URL
$callbackUrl = "$tunnelUrl/ussd"

Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              ✅ CALLBACK URL READY!                    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📱 Your Africa's Talking Callback URL:`n" -ForegroundColor Cyan
Write-Host "   $callbackUrl" -ForegroundColor Green
Write-Host "`n   ✅ COPIED TO CLIPBOARD!`n" -ForegroundColor Yellow

# Copy to clipboard
Set-Clipboard -Value $callbackUrl

# Save to file
$callbackUrl | Out-File -FilePath "C:\Users\Admin\USSD\CURRENT_TUNNEL_URL.txt" -Encoding UTF8

Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "🔧 NEXT STEPS:`n" -ForegroundColor Yellow
Write-Host "1. Go to: https://account.africastalking.com/apps/sandbox/ussd/numbers" -ForegroundColor White
Write-Host "2. Find: *384*8481#" -ForegroundColor White
Write-Host "3. Click on the callback URL field" -ForegroundColor White
Write-Host "4. Press Ctrl+V to paste: $callbackUrl" -ForegroundColor Green
Write-Host "5. Click SAVE" -ForegroundColor White
Write-Host "6. Test by dialing *384*8481# in simulator`n" -ForegroundColor White

# Test connectivity
Write-Host "🧪 Testing tunnel connectivity..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 10
    Write-Host "✅ SUCCESS! Backend is reachable through tunnel.`n" -ForegroundColor Green
    Write-Host "   USSD Status: $($health.ussd)" -ForegroundColor White
    Write-Host "   Members: $($health.counts.members)" -ForegroundColor White
    Write-Host "   Issues: $($health.counts.issues)`n" -ForegroundColor White
    Write-Host "✅ Your USSD will work once you update Africa's Talking!`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not test tunnel (it may take a minute to activate)" -ForegroundColor Yellow
    Write-Host "   Update Africa's Talking and try dialing anyway.`n" -ForegroundColor Gray
}

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  💾 Saved to: CURRENT_TUNNEL_URL.txt" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Read-Host "Press Enter to close"
