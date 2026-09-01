@echo off
echo ==============================================
echo   RUBARU PORT FORWARDER (USB DEBUGGING)
echo ==============================================
echo.
echo [1/2] Forwarding Metro Bundler (port 8081)...
call npx adb reverse tcp:8081 tcp:8081

echo [2/2] Forwarding Backend Server (port 5000)...
call npx adb reverse tcp:5000 tcp:5000

echo.
echo Ports forwarded successfully! Make sure your phone is connected via USB with USB Debugging turned ON.
echo.
pause
