@echo off
REM Voo Kyamatu Frontend Startup Script (Command Prompt)
echo.
echo ========================================
echo  VOO KYAMATU FRONTEND STARTUP
echo ========================================
echo.

REM Check if port 5173 is in use
netstat -ano | findstr :5173 >nul
if %ERRORLEVEL% == 0 (
    echo [ERROR] Port 5173 is already in use!
    echo.
    echo To kill the process:
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
        echo   taskkill /F /PID %%a
    )
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting frontend server...
echo [INFO] Port: 5173
echo [INFO] URL: http://127.0.0.1:5173
echo.

REM Start the server
npm run dev

pause
