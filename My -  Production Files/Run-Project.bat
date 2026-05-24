@echo off
setlocal

:: Navigate to the directory where this script is located
cd /d "%~dp0"

echo ========================================================
echo Starting College Recommendation Demo
echo ========================================================
echo.

echo Starting backend API natively...
:: We must provide these environment variables, otherwise the node server crashes!
set API_KEY=dev-key-change-me
set INGEST_DIR=../../data/input
set PORT=8080

start cmd /k "cd ..\college-cds-api-main\api && npm install && node --no-warnings=ExperimentalWarning src/ingest.js && node --no-warnings=ExperimentalWarning src/server.js"

echo Waiting for API to become ready (approx 10 seconds)...
timeout /t 10 /nobreak > nul

echo.
echo Opening College-List-Demo.html in default browser...
start College-List-Demo.html

echo.
echo ========================================================
echo Application is running locally (No Docker).
echo To view API logs, check the newly opened terminal window.
echo Close this window if you wish, or keep it open for reference.
echo ========================================================
pause
