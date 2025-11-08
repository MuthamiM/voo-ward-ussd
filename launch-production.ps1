# Quick Launch Script for Production Testing with Ngrok
# This script starts your backend and exposes it via ngrok

param(
    [switch]$UseCloudflare,
    [string]$Port = "4000"
)

$ErrorActionPreference = "Stop"

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "  Kyamatu USSD - Production Launch" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# Check if backend directory exists
$BackendDir = "C:\Users\Admin\USSD\backend"
if (-not (Test-Path $BackendDir)) {
    Write-Host "ERROR: Backend directory not found: $BackendDir" -ForegroundColor Red
    exit 1
}

Set-Location $BackendDir

# Check if node is available
$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
    Write-Host "ERROR: Node.js not found in PATH" -ForegroundColor Red
    exit 1
}

# Kill any existing node processes
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null | Out-Null
Start-Sleep -Seconds 2

# Check database connectivity
Write-Host "Checking database connection..." -ForegroundColor Yellow
$DbUrl = "postgresql://postgres:23748124@localhost:5432/voo_db"
$env:PGPASSWORD = "23748124"

try {
    $TestConnection = & psql -h localhost -p 5432 -U postgres -d voo_db -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Database connection failed" -ForegroundColor Yellow
        Write-Host "Make sure PostgreSQL is running" -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not test database connection" -ForegroundColor Yellow
}

Write-Host ""

# Set environment variables
$env:DB_URL = $DbUrl
$env:NODE_ENV = "production"
$env:PORT = $Port
$env:ADMIN_EXPORT_KEY = "kyamatu-secure-2024"
$env:RATE_LIMIT_MAX = "30"
$env:RATE_LIMIT_WINDOW_MS = "300000"
$env:METRICS_ENABLED = "true"
$env:VERIFY_SIGNATURE = "false"  # Disable for testing

Write-Host "Environment Configuration:" -ForegroundColor Yellow
Write-Host "  DB_URL: postgresql://postgres:***@localhost:5432/voo_db" -ForegroundColor White
Write-Host "  PORT: $Port" -ForegroundColor White
Write-Host "  NODE_ENV: production" -ForegroundColor White
Write-Host "  RATE_LIMIT_MAX: 30 requests / 5 minutes" -ForegroundColor White
Write-Host "  VERIFY_SIGNATURE: false (testing mode)" -ForegroundColor White
Write-Host ""

# Start backend in background
Write-Host "Starting backend server..." -ForegroundColor Yellow
$BackendJob = Start-Job -ScriptBlock {
    param($BackendDir, $DbUrl, $Port)
    Set-Location $BackendDir
    $env:DB_URL = $DbUrl
    $env:NODE_ENV = "production"
    $env:PORT = $Port
    $env:ADMIN_EXPORT_KEY = "kyamatu-secure-2024"
    $env:RATE_LIMIT_MAX = "30"
    $env:METRICS_ENABLED = "true"
    $env:VERIFY_SIGNATURE = "false"
    & node src\index.js
} -ArgumentList $BackendDir, $DbUrl, $Port

# Wait for server to start
Start-Sleep -Seconds 5

# Check if server is running
Write-Host "Checking server status..." -ForegroundColor Yellow
try {
    $Health = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 5
    Write-Host "✓ Backend server is running!" -ForegroundColor Green
    Write-Host "  Status: $($Health.status)" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "✗ Backend failed to start" -ForegroundColor Red
    Write-Host "Check logs for errors" -ForegroundColor Red
    
    # Show job output
    $JobOutput = Receive-Job -Job $BackendJob
    if ($JobOutput) {
        Write-Host "`nServer Output:" -ForegroundColor Yellow
        Write-Host $JobOutput -ForegroundColor Gray
    }
    
    Stop-Job -Job $BackendJob
    Remove-Job -Job $BackendJob
    exit 1
}

# Start tunnel
Write-Host "===============================================" -ForegroundColor Cyan
if ($UseCloudflare) {
    Write-Host "  Starting Cloudflare Tunnel" -ForegroundColor Cyan
    Write-Host "===============================================`n" -ForegroundColor Cyan
    
    $Cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
    if (-not $Cloudflared) {
        Write-Host "ERROR: cloudflared not found in PATH" -ForegroundColor Red
        Write-Host "Install from: https://github.com/cloudflare/cloudflared/releases" -ForegroundColor Yellow
        Stop-Job -Job $BackendJob
        Remove-Job -Job $BackendJob
        exit 1
    }
    
    Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Yellow
    Write-Host "This will generate a temporary URL (changes on restart)" -ForegroundColor Gray
    Write-Host ""
    
    & cloudflared tunnel --url "http://localhost:$Port"
    
} else {
    Write-Host "  Starting Ngrok Tunnel" -ForegroundColor Cyan
    Write-Host "===============================================`n" -ForegroundColor Cyan
    
    $Ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $Ngrok) {
        Write-Host "ERROR: ngrok not found in PATH" -ForegroundColor Red
        Write-Host "Install from: https://ngrok.com/download" -ForegroundColor Yellow
        Stop-Job -Job $BackendJob
        Remove-Job -Job $BackendJob
        exit 1
    }
    
    Write-Host "Starting ngrok tunnel..." -ForegroundColor Yellow
    Write-Host "This will generate a public HTTPS URL" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "IMPORTANT: Copy the HTTPS URL and configure in Africa's Talking:" -ForegroundColor Yellow
    Write-Host "  1. Login to https://account.africastalking.com/" -ForegroundColor White
    Write-Host "  2. Go to USSD → Your Service → Callback URL" -ForegroundColor White
    Write-Host "  3. Enter: https://YOUR-NGROK-URL/ussd" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop both backend and ngrok" -ForegroundColor Cyan
    Write-Host ""
    
    # Start ngrok
    & ngrok http $Port
}

# Cleanup on exit
Write-Host "`nStopping services..." -ForegroundColor Yellow
Stop-Job -Job $BackendJob -ErrorAction SilentlyContinue
Remove-Job -Job $BackendJob -ErrorAction SilentlyContinue
taskkill /F /IM node.exe 2>$null | Out-Null
Write-Host "✓ Services stopped" -ForegroundColor Green
