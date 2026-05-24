@echo off
echo ========================================================
echo Starting DreamCollege Local Server
echo ========================================================
echo.
echo This script starts a local server to prevent browser CORS
echo security errors when loading the local database JSON files.
echo.
echo Starting Python HTTP Server on port 8000...
start "DreamCollege Server" cmd /c "python -m http.server 8000"
timeout /t 2 >nul
echo.
echo Opening browser...
start http://localhost:8000/College-List-Demo.html
echo.
echo Note: Keep the other black command window open while testing!
echo Press any key to exit this script.
pause >nul
