@echo off
REM Voo Kyamatu Backend Startup Script (Command Prompt)
echo.
echo ========================================
echo  VOO KYAMATU BACKEND STARTUP
echo ========================================
echo.

REM Check if port 4000 is in use
netstat -ano | findstr :4000 >nul
if %ERRORLEVEL% == 0 (
    echo [ERROR] Port 4000 is already in use!
    echo.
    echo To kill the process:
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000') do (
        echo   taskkill /F /PID %%a
    )
    echo.
    pause
    exit /b 1
)

REM Set environment variables
set DB_URL=postgresql://postgres:23748124@localhost:5432/voo_db
set NODE_ENV=production
set PORT=4000

echo [INFO] Starting backend server...
echo [INFO] Database: PostgreSQL (voo_db)
echo [INFO] Port: 4000
echo [INFO] Mode: PRODUCTION
echo.

REM Start the server
node src\index.js

pause
