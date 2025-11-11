# PostgreSQL Backup Script for Windows (PowerShell)
# Creates timestamped compressed backup of voo_db database

param(
    [string]$BackupDir = ".\backups",
    [string]$DbName = $env:PGDATABASE,
    [string]$DbHost = $env:PGHOST,
    [string]$DbPort = $env:PGPORT,
    [string]$DbUser = $env:PGUSER,
    [int]$RetentionDays = 30
)

# Default values
if ([string]::IsNullOrEmpty($DbName)) { $DbName = "voo_db" }
if ([string]::IsNullOrEmpty($DbHost)) { $DbHost = "localhost" }
if ([string]::IsNullOrEmpty($DbPort)) { $DbPort = "5432" }
if ([string]::IsNullOrEmpty($DbUser)) { $DbUser = "postgres" }

# Timestamp for backup file
$Timestamp = Get-Date -Format "yyyyMMdd_HHmm"
$BackupFileName = "voo_db_${Timestamp}.sql"
$BackupFilePath = Join-Path $BackupDir $BackupFileName
$CompressedFilePath = "${BackupFilePath}.gz"

# Create backup directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    Write-Host "Creating backup directory: $BackupDir" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "`n===============================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL Backup - voo_db Database" -ForegroundColor Cyan
Write-Host "===============================================`n" -ForegroundColor Cyan

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $DbName" -ForegroundColor White
Write-Host "  Host: $DbHost" -ForegroundColor White
Write-Host "  Port: $DbPort" -ForegroundColor White
Write-Host "  User: $DbUser" -ForegroundColor White
Write-Host "  Backup Dir: $BackupDir" -ForegroundColor White
Write-Host "  File: $BackupFileName" -ForegroundColor White
Write-Host ""

# Check if pg_dump is available
$PgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $PgDump) {
    Write-Host "ERROR: pg_dump not found in PATH" -ForegroundColor Red
    Write-Host "Please ensure PostgreSQL client tools are installed and in PATH" -ForegroundColor Red
    exit 1
}

# Set PGPASSWORD environment variable (if not already set)
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    Write-Host "WARNING: PGPASSWORD environment variable not set" -ForegroundColor Yellow
    Write-Host "You may be prompted for the database password" -ForegroundColor Yellow
    Write-Host ""
}

try {
    Write-Host "Creating database dump..." -ForegroundColor Yellow
    
    # Run pg_dump
    $PgDumpArgs = @(
        "--host=$DbHost",
        "--port=$DbPort",
        "--username=$DbUser",
        "--format=plain",
        "--verbose",
        "--file=$BackupFilePath",
        $DbName
    )
    
    & pg_dump @PgDumpArgs 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "✓ Database dump created successfully" -ForegroundColor Green
    
    # Get file size
    $FileSize = (Get-Item $BackupFilePath).Length
    $FileSizeMB = [math]::Round($FileSize / 1MB, 2)
    Write-Host "  File size: $FileSizeMB MB" -ForegroundColor White
    
    # Compress with gzip (if available)
    $Gzip = Get-Command gzip -ErrorAction SilentlyContinue
    if ($Gzip) {
        Write-Host "`nCompressing backup..." -ForegroundColor Yellow
        & gzip -f $BackupFilePath
        
        if (Test-Path $CompressedFilePath) {
            $CompressedSize = (Get-Item $CompressedFilePath).Length
            $CompressedSizeMB = [math]::Round($CompressedSize / 1MB, 2)
            $CompressionRatio = [math]::Round((1 - ($CompressedSize / $FileSize)) * 100, 1)
            
            Write-Host "✓ Backup compressed successfully" -ForegroundColor Green
            Write-Host "  Compressed size: $CompressedSizeMB MB" -ForegroundColor White
            Write-Host "  Compression ratio: $CompressionRatio%" -ForegroundColor White
            
            $FinalFile = $CompressedFilePath
        } else {
            Write-Host "✗ Compression failed, keeping uncompressed backup" -ForegroundColor Yellow
            $FinalFile = $BackupFilePath
        }
    } else {
        Write-Host "`nWARNING: gzip not found, backup will not be compressed" -ForegroundColor Yellow
        $FinalFile = $BackupFilePath
    }
    
    # Cleanup old backups
    Write-Host "`nCleaning up old backups (older than $RetentionDays days)..." -ForegroundColor Yellow
    $CutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $OldBackups = Get-ChildItem $BackupDir -Filter "voo_db_*.sql*" | Where-Object {
        $_.CreationTime -lt $CutoffDate
    }
    
    if ($OldBackups.Count -gt 0) {
        $OldBackups | ForEach-Object {
            Write-Host "  Removing: $($_.Name)" -ForegroundColor Gray
            Remove-Item $_.FullName -Force
        }
        Write-Host "✓ Removed $($OldBackups.Count) old backup(s)" -ForegroundColor Green
    } else {
        Write-Host "  No old backups to remove" -ForegroundColor White
    }
    
    # Summary
    Write-Host "`n===============================================" -ForegroundColor Cyan
    Write-Host "  Backup Completed Successfully!" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "  Location: $FinalFile" -ForegroundColor White
    Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor White
    Write-Host "`n"
    
} catch {
    Write-Host "`nERROR: Backup failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
