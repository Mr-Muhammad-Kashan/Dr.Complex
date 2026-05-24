@echo off
setlocal

echo ========================================================
echo Starting College Recommendation Demo
echo ========================================================
echo.

echo Starting backend API...
start cmd /k "cd ..\college-cds-api-main\api && npm run docker:start"

echo Waiting for API to become ready (approx 10 seconds)...
timeout /t 10 /nobreak > nul

echo.
echo Opening College-List-Demo.html in default browser...
start College-List-Demo.html

echo.
echo ========================================================
echo Application is running.
echo To view API logs, check the newly opened terminal window.
echo Close this window if you wish, or keep it open for reference.
echo ========================================================
pause
