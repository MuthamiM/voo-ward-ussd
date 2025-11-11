# Start Cloudflare Tunnel for VOO KYAMATU Backend
# This exposes localhost:4000 to the internet

Write-Host "`n" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " VOO KYAMATU - CLOUDFLARE TUNNEL STARTING" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "`n"

# Check if cloudflared exists
$cloudflaredPath = "$env:USERPROFILE\cloudflared.exe"
if (!(Test-Path $cloudflaredPath)) {
    Write-Host "✗ cloudflared.exe not found!" -ForegroundColor Red
    Write-Host "  Expected location: $cloudflaredPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Found cloudflared.exe" -ForegroundColor Green
Write-Host "✓ Exposing: http://localhost:4000" -ForegroundColor Green
Write-Host "`n"
Write-Host "⚡ Starting tunnel..." -ForegroundColor Yellow
Write-Host "   Look for the public URL below ↓" -ForegroundColor Cyan
Write-Host "`n"

# Start the tunnel
& $cloudflaredPath tunnel --url http://localhost:4000
