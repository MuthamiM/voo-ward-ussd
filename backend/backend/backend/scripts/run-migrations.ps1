# Run Database Migrations
# Execute this script to apply all migrations

$ErrorActionPreference = "Stop"

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "  Database Migrations - voo_db" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

# Configuration
$DbName = if ($env:PGDATABASE) { $env:PGDATABASE } else { "voo_db" }
$DbHost = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$DbPort = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$DbUser = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $DbName" -ForegroundColor White
Write-Host "  Host: $DbHost" -ForegroundColor White
Write-Host "  Port: $DbPort" -ForegroundColor White
Write-Host "  User: $DbUser" -ForegroundColor White
Write-Host ""

# Check if psql is available
$Psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $Psql) {
    Write-Host "ERROR: psql not found in PATH" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL client tools are installed" -ForegroundColor Red
    exit 1
}

# Check PGPASSWORD
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    Write-Host "WARNING: PGPASSWORD environment variable not set" -ForegroundColor Yellow
    Write-Host "You may be prompted for the database password" -ForegroundColor Yellow
    Write-Host ""
}

# Migration files
$Migrations = @(
    @{
        File = "db\migrations\001_preferences.sql"
        Description = "Create preferences table for language settings"
    },
    @{
        File = "db\migrations\002_audit_index.sql"
        Description = "Add performance indexes on audit_events"
    }
)

$SuccessCount = 0
$FailCount = 0

foreach ($Migration in $Migrations) {
    $FilePath = $Migration.File
    $Description = $Migration.Description
    
    Write-Host "Running: $FilePath" -ForegroundColor Yellow
    Write-Host "  $Description" -ForegroundColor Gray
    
    if (-not (Test-Path $FilePath)) {
        Write-Host "  ERROR: File not found" -ForegroundColor Red
        $FailCount++
        continue
    }
    
    try {
        $Output = & psql --host=$DbHost --port=$DbPort --username=$DbUser --dbname=$DbName --file=$FilePath 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Success" -ForegroundColor Green
            $SuccessCount++
        } else {
            Write-Host "  ✗ Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
            Write-Host "  Output: $Output" -ForegroundColor Red
            $FailCount++
        }
    } catch {
        Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
        $FailCount++
    }
    
    Write-Host ""
}

# Summary
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Migration Summary" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Success: $SuccessCount" -ForegroundColor Green
Write-Host "  Failed: $FailCount" -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "White" })
Write-Host ""

if ($FailCount -gt 0) {
    Write-Host "Some migrations failed. Please review errors above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "All migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
}
