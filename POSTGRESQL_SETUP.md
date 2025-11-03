# PostgreSQL Setup for VOO KYAMATU

## Step 1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Click "Download the installer"
3. Download **PostgreSQL 16** (latest stable version)
4. Run the installer (`postgresql-16.x-windows-x64.exe`)

## Step 2: Installation Settings

During installation, use these settings:

- **Installation Directory**: `C:\Program Files\PostgreSQL\16`
- **Data Directory**: `C:\Program Files\PostgreSQL\16\data`
- **Password**: Choose a strong password (you'll need this!)
- **Port**: `5432` (default)
- **Locale**: Default
- **Components**: Install all (PostgreSQL Server, pgAdmin 4, Command Line Tools)

**IMPORTANT**: Remember your password! Write it down!

## Step 3: Verify Installation

After installation completes, open PowerShell and run:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
```

You should see: `psql (PostgreSQL) 16.x`

## Step 4: Create Database

Open PowerShell as Administrator and run:

```powershell
# Set password as environment variable (replace YOUR_PASSWORD)
$env:PGPASSWORD = "YOUR_PASSWORD"

# Connect to PostgreSQL
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE voo_db;"

# Verify database created
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "\l"
```

## Step 5: Run Migrations

```powershell
# Navigate to backend folder
cd c:\Users\Admin\USSD\backend

# Run the main migration
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db -f migrations\cloud\01_init.sql

# Run the updates migration
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db -f migrations\02_add_source_comments.sql
```

## Step 6: Update Environment Variables

Create a file `c:\Users\Admin\USSD\backend\.env`:

```env
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=voo_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE
JWT_SECRET=your-super-secret-key-change-this-in-production
PORT=4000
```

## Step 7: Install PostgreSQL Node Package

```powershell
cd c:\Users\Admin\USSD\backend
npm install pg
```

## Step 8: Test Database Connection

```powershell
cd c:\Users\Admin\USSD\backend
node -e "const {Pool} = require('pg'); const pool = new Pool({host:'localhost',port:5432,database:'voo_db',user:'postgres',password:'YOUR_PASSWORD'}); pool.query('SELECT NOW()', (err, res) => {console.log(err ? 'ERROR: ' + err : 'SUCCESS: ' + res.rows[0].now); pool.end();});"
```

## Step 9: Start Server in Production Mode

```powershell
cd c:\Users\Admin\USSD\backend
Remove-Item Env:\NODE_ENV  # Remove development mode
node src/index.js
```

## Troubleshooting

### PostgreSQL service not running

```powershell
# Start PostgreSQL service
Start-Service postgresql-x64-16
```

### Can't connect to database

```powershell
# Check if PostgreSQL is running
Get-Service postgresql-x64-16

# Check if port 5432 is listening
Test-NetConnection -ComputerName localhost -Port 5432
```

### Forgot password
You'll need to reset it by editing `pg_hba.conf` - see PostgreSQL documentation.

## Quick Commands

```powershell
# Connect to database
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db

# View all tables
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db -c "\dt"

# View all issues
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db -c "SELECT * FROM issues;"

# Backup database
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres voo_db > backup.sql

# Restore database
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d voo_db -f backup.sql
```

## Download Link

**Direct Download**: https://sbp.enterprisedb.com/getfile.jsp?fileid=1258893

Time to complete: **30-45 minutes**
