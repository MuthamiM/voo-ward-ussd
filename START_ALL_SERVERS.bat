@echo off
echo.
echo ================================================
echo  VOO KYAMATU - STARTING ALL SERVERS
echo ================================================
echo.

REM Start Backend in new window
echo Starting Backend Server (Port 4000)...
start "VOO-Backend" powershell -NoExit -Command "cd C:\Users\Admin\USSD\backend; Write-Host '=== BACKEND SERVER ===' -ForegroundColor Green; node src\index.js"

timeout /t 3 /nobreak >nul

REM Start Frontend in new window
echo Starting Frontend Dashboard (Port 5173)...
start "VOO-Frontend" powershell -NoExit -Command "cd C:\Users\Admin\USSD\frontend; Write-Host '=== FRONTEND DASHBOARD ===' -ForegroundColor Cyan; npm run dev"

timeout /t 3 /nobreak >nul

REM Start Cloudflare Tunnel in new window
echo Starting Cloudflare Tunnel...
start "VOO-Tunnel" powershell -NoExit -Command "Write-Host '=== CLOUDFLARE TUNNEL ===' -ForegroundColor Yellow; Write-Host 'Your PUBLIC URL will appear below:' -ForegroundColor Cyan; Write-Host ''; & '%USERPROFILE%\cloudflared.exe' tunnel --url http://localhost:4000"

echo.
echo ================================================
echo  ALL SERVERS STARTING IN SEPARATE WINDOWS
echo ================================================
echo.
echo  Backend:  http://localhost:4000
echo  Frontend: http://localhost:5173
echo  Tunnel:   Check the Cloudflare window for URL
echo.
pause
