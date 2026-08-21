@echo off
echo ==============================================
echo   RUBARU METRO AND TUNNEL AUTO-FIXER
echo ==============================================
echo.

echo [1/4] Force-closing locking processes (Node and Java)...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im java.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Cleanly deleting node_modules and lockfile...
if exist node_modules (
    rmdir /s /q node_modules
)
if exist package-lock.json (
    del /f /q package-lock.json
)

echo [3/4] Running fresh package installation...
call npm install --legacy-peer-deps

echo [4/4] Starting Expo Go with Tunnel and clear cache...
call npx expo start --tunnel --clear

echo.
echo Process complete. If the terminal closes, please restart npx expo start --tunnel.
pause
