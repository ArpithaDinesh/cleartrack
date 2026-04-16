@echo off
echo Starting CLEARTRACK System...

echo Starting Backend Service (Port 5000)...
start "Backend" cmd /k "cd cleartrack-backend && npm start"

echo Starting Frontend Service (Port 5173)...
start "Frontend" cmd /k "cd cleartrack-react && npm run dev"

echo.
echo =========================================================
echo Both services are now starting in separate windows.
echo Please leave the black windows open!
echo.
echo Opening browser to http://localhost:5173...
echo =========================================================

timeout /t 3 >nul
start http://localhost:5173
