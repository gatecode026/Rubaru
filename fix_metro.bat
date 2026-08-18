@echo off
echo ==============================================
echo   RUBARU METRO AND DEPENDENCY AUTO-FIXER
echo ==============================================
echo.

echo [1/4] Force-closing locking processes (Node & Java)...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im java.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Cleanly deleting node_modules & lockfile (w/ long path support)...
if exist node_modules (
    rmdir /s /q node_modules
)
if exist package-lock.json (
    del /f /q package-lock.json
)

echo [3/4] Running fresh package installation (legacy peer deps allowed)...
call npm install --legacy-peer-deps

echo [4/4] Starting Expo Go with clear cache...
call npx expo start --go --clear

echo.
echo Process complete. If the terminal closes, please restart npx expo start.
pause
