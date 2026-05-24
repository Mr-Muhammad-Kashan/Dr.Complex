@echo off
setlocal

echo ========================================================
echo Starting College Recommendation Demo
echo ========================================================
echo.

echo Staging data files for backend API...
if not exist "..\college-cds-api-main\api\seed" mkdir "..\college-cds-api-main\api\seed"
del /Q "..\college-cds-api-main\api\seed\*.json" 2>nul
copy "..\college-cds-api-main\data\input\*.json" "..\college-cds-api-main\api\seed\" >nul

echo Starting backend API natively...
set INGEST_DIR=seed
start cmd /k "cd ..\college-cds-api-main\api && npm install && node --no-warnings=ExperimentalWarning src/ingest.js && node --no-warnings=ExperimentalWarning src/server.js"

echo Waiting for API to become ready (approx 10 seconds)...
timeout /t 10 /nobreak > nul

echo.
echo Opening College-List-Demo.html in default browser...
start College-List-Demo.html

echo.
echo ========================================================
echo Application is running without Docker.
echo To view API logs, check the newly opened terminal window.
echo Close this window if you wish, or keep it open for reference.
echo ========================================================
pause
