@echo off
title Rubaru Firewall Fixer
color 0A

echo ================================================================
echo               RUBARU BACKEND FIREWALL UNBLOCKER
echo ================================================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    color 0C
    echo [ERROR] This script requires Administrator privileges.
    echo.
    echo Please RIGHT-CLICK this file and select "RUN AS ADMINISTRATOR".
    echo.
    pause
    exit /b 1
)

echo [1/3] Removing blocking rules for node.exe...
netsh advfirewall firewall delete rule name="node.exe"

echo.
echo [2/3] Adding inbound allow rule for Port 5000 (Rubaru Backend)...
netsh advfirewall firewall add rule name="Rubaru Backend Port 5000" dir=in action=allow protocol=TCP localport=5000 profile=any

echo.
echo [3/3] Setting Wi-Fi network category to Private...
powershell -Command "Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private"

echo.
echo ================================================================
echo   SUCCESS! Windows Firewall is now allowing Port 5000 and Node!
echo   Your phone will now connect seamlessly.
echo ================================================================
echo.
pause
