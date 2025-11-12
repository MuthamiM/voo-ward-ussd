# Database Migration Runner
# Runs all migrations in order

Write-Host "`n🔧 Running Database Migrations..." -ForegroundColor Cyan

# Set PostgreSQL password
$env:PGPASSWORD = '23748124'

$migrations = @(
    "src\db\migrations\001_preferences.sql",
    "src\db\migrations\002_audit_index.sql"
)

foreach ($migration in $migrations) {
    $migrationName = Split-Path $migration -Leaf
    Write-Host "`n📝 Running $migrationName..." -ForegroundColor Yellow
    
    try {
        psql -h localhost -U postgres -d voo_db -f $migration
        Write-Host "✅ $migrationName completed" -ForegroundColor Green
    } catch {
        Write-Host "❌ $migrationName failed: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✅ All migrations completed successfully!" -ForegroundColor Green
Write-Host "`n📊 Checking tables..." -ForegroundColor Cyan

# Verify preferences table
$query = "SELECT COUNT(*) as rows FROM preferences;"
$result = psql -h localhost -U postgres -d voo_db -t -c $query
Write-Host "   preferences table: $result rows" -ForegroundColor Cyan

Write-Host "`n✅ Database ready!" -ForegroundColor Green
