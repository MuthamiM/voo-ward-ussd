@echo off
echo.
echo ========================================
echo   STARTING ENHANCED KYAMATU BACKEND
echo ========================================
echo.

cd /d C:\Users\Admin\USSD\backend

set DB_URL=postgresql://postgres:23748124@localhost:5432/voo_db
set NODE_ENV=production
set PORT=4000

echo Starting backend on port 4000...
echo.

node src\index.js

pause
