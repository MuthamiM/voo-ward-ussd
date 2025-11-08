# Prepare for DigitalOcean Deployment
# This script packages your backend for easy upload

$ErrorActionPreference = "Stop"

Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DigitalOcean Deployment Preparation" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════`n" -ForegroundColor Cyan

$BackendPath = "C:\Users\Admin\USSD\backend"
$DeployPath = "C:\Users\Admin\USSD\deploy-package"

# Clean old deployment package
if (Test-Path $DeployPath) {
    Write-Host "[1/5] Removing old deployment package..." -ForegroundColor Yellow
    Remove-Item -Path $DeployPath -Recurse -Force
}

# Create deployment directory
Write-Host "[2/5] Creating deployment package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $DeployPath | Out-Null

# Copy necessary files (exclude node_modules, logs, temp files)
Write-Host "[3/5] Copying application files..." -ForegroundColor Yellow

$ItemsToCopy = @(
    "src",
    "db",
    "scripts",
    "package.json",
    "package-lock.json"
)

foreach ($Item in $ItemsToCopy) {
    $Source = Join-Path $BackendPath $Item
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $DeployPath -Recurse -Force
        Write-Host "  ✓ Copied $Item" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Skipped $Item (not found)" -ForegroundColor Yellow
    }
}

# Create .env template
Write-Host "[4/5] Creating .env template..." -ForegroundColor Yellow
$EnvTemplate = @"
NODE_ENV=production
DB_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/voo_db
PORT=4000
JWT_SECRET=CHANGE-THIS-TO-RANDOM-STRING
ADMIN_EXPORT_KEY=kyamatu-secure-2024-CHANGE-THIS

# Rate limiting
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX=30

# Metrics
METRICS_ENABLED=true

# Africa's Talking (optional)
VERIFY_SIGNATURE=false
AT_API_KEY=your-api-key-here

# Database connection (alternative format)
PGHOST=localhost
PGPORT=5432
PGDATABASE=voo_db
PGUSER=postgres
PGPASSWORD=YOUR_PASSWORD
"@

$EnvPath = Join-Path $DeployPath ".env.example"
$EnvTemplate | Out-File -FilePath $EnvPath -Encoding utf8
Write-Host "  ✓ Created .env.example" -ForegroundColor Green

# Create deployment instructions
Write-Host "[5/5] Creating deployment instructions..." -ForegroundColor Yellow
$Instructions = @"
# Quick Deployment Instructions

## 1. Upload to DigitalOcean

From PowerShell:
```powershell
cd C:\Users\Admin\USSD
scp -r deploy-package root@YOUR_DROPLET_IP:/var/www/kyamatu-ussd
```

## 2. On the Server

```bash
cd /var/www/kyamatu-ussd/deploy-package
npm install --production
cp .env.example .env
nano .env  # Edit with your actual values

# Start with PM2
pm2 start src/index.js --name kyamatu-ussd
pm2 save
pm2 startup systemd
```

## 3. Verify

```bash
pm2 logs kyamatu-ussd
curl http://localhost:4000/health
```

---

See DIGITALOCEAN_DEPLOYMENT.md for full setup guide.
"@

$DeployMdPath = Join-Path $DeployPath "DEPLOY.md"
$Instructions | Out-File -FilePath $DeployMdPath -Encoding utf8

# Get package size
$Size = (Get-ChildItem -Path $DeployPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "`n═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ DEPLOYMENT PACKAGE READY!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Location: $DeployPath" -ForegroundColor White
Write-Host "Size: $([math]::Round($Size, 2)) MB`n" -ForegroundColor White

Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "`n1. Create DigitalOcean Droplet:" -ForegroundColor Cyan
Write-Host "   - Go to https://www.digitalocean.com" -ForegroundColor White
Write-Host "   - Create Droplet: Ubuntu 22.04, $6/month" -ForegroundColor White
Write-Host "   - Note the IP address`n" -ForegroundColor White

Write-Host "2. Upload your application:" -ForegroundColor Cyan
Write-Host "   cd C:\Users\Admin\USSD" -ForegroundColor White
Write-Host "   scp -r deploy-package root@YOUR_DROPLET_IP:/var/www/kyamatu-ussd`n" -ForegroundColor White

Write-Host "3. Follow the full guide:" -ForegroundColor Cyan
Write-Host "   backend\DIGITALOCEAN_DEPLOYMENT.md`n" -ForegroundColor White

Write-Host "DEPLOYMENT CHECKLIST:" -ForegroundColor Yellow
Write-Host "  [ ] Create DigitalOcean account" -ForegroundColor DarkGray
Write-Host "  [ ] Create droplet ($6/month Ubuntu 22.04)" -ForegroundColor DarkGray
Write-Host "  [ ] Install Node.js, PostgreSQL, Nginx" -ForegroundColor DarkGray
Write-Host "  [ ] Upload application files" -ForegroundColor DarkGray
Write-Host "  [ ] Configure .env with database password" -ForegroundColor DarkGray
Write-Host "  [ ] Run migrations" -ForegroundColor DarkGray
Write-Host "  [ ] Start with PM2" -ForegroundColor DarkGray
Write-Host "  [ ] Setup Nginx reverse proxy" -ForegroundColor DarkGray
Write-Host "  [ ] Configure Africa's Talking webhook" -ForegroundColor DarkGray
Write-Host "  [ ] Test in simulator`n" -ForegroundColor DarkGray

Write-Host "Full guide: " -NoNewline -ForegroundColor White
Write-Host "backend\DIGITALOCEAN_DEPLOYMENT.md`n" -ForegroundColor Cyan
