@echo off
title Fixed Income Workstation (Standalone - No Node.js Required)

:: Force window to stay open if double-clicked
if "%~1" neq "__PERSIST__" (
    start "Fixed Income Workstation" cmd.exe /k ""%~f0" __PERSIST__ %*"
    exit /b
)

cd /d "%~dp0"

echo ===============================================================================
echo          FIXED INCOME PORTFOLIO MANAGEMENT WORKSTATION
echo        Standalone Windows Launcher (No Node.js Required)
echo ===============================================================================
echo.
echo Launching workstation using Windows built-in web engine...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.
echo ===============================================================================
echo Server stopped. Press any key to close this window.
echo ===============================================================================
pause
