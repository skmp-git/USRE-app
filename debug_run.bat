@echo off
:: Ensure persistent cmd.exe /k session so the window CANNOT close
if "%~1" neq "__PERSIST__" (
    start "Fixed Income Workstation - Diagnostic Console" cmd.exe /k ""%~f0" __PERSIST__ %*"
    exit /b
)
shift

title Fixed Income Workstation - Diagnostic Console
color 0A

echo ===============================================================================
echo       FIXED INCOME WORKSTATION - SYSTEM DIAGNOSTIC LAUNCHER
echo ===============================================================================
echo This debug script checks your Node.js, NPM, and workstation files,
echo and keeps the command prompt window OPEN permanently so you can inspect all logs.
echo ===============================================================================
echo.

cd /d "%~dp0"
echo [DIAGNOSTIC 1] Current Folder: %CD%
echo [DIAGNOSTIC 2] Computer Name:  %COMPUTERNAME%
echo [DIAGNOSTIC 3] User Profile:   %USERPROFILE%
echo.

:: Test PATH additions for standard Node.js installations
if exist "%ProgramFiles%\nodejs\node.exe" (
    echo [+] Adding standard 64-bit Node directory to session PATH: %ProgramFiles%\nodejs
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    echo [+] Adding 32-bit Node directory to session PATH: %ProgramFiles(x86)%\nodejs
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    echo [+] Adding User-local Node directory to session PATH: %LOCALAPPDATA%\Programs\nodejs
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)
if exist "%APPDATA%\npm" (
    echo [+] Adding AppData npm to session PATH: %APPDATA%\npm
    set "PATH=%APPDATA%\npm;%PATH%"
)
echo.

:: Check Node.js
echo [DIAGNOSTIC 4] Testing Node execution:
node -e "console.log('Node.js successfully running: ' + process.version)" 2>nul
if errorlevel 1 (
    echo.
    echo -------------------------------------------------------------------------------
    echo [FAIL] Node.js was NOT found or could not execute!
    echo -------------------------------------------------------------------------------
    echo Don't worry! You can run the workstation WITHOUT Node.js by running:
    echo    launch_without_node.bat
    echo.
    echo Or download and install Node.js (LTS version) from: https://nodejs.org/
    echo -------------------------------------------------------------------------------
    echo.
    echo Press any key to test the Standalone Windows Web Server...
    pause >nul
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
    goto :prompt_keep_open
)

echo.
echo [DIAGNOSTIC 5] Checking npm:
cmd.exe /c "npm -v" 2>nul
echo.

:: Check node_modules
echo [DIAGNOSTIC 6] Checking node_modules folder:
if exist "%~dp0node_modules\vite\bin\vite.js" (
    echo [+] node_modules and Vite are present and ready.
) else (
    echo [!] node_modules is missing! Running 'npm install'...
    cmd.exe /c "npm install"
    if errorlevel 1 (
        echo [FAIL] npm install encountered an error.
        echo Falling back to standalone server:
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
        goto :prompt_keep_open
    )
)
echo.

:: Check port 3000
echo [DIAGNOSTIC 7] Checking if port 3000 is occupied by another app:
netstat -ano | findstr :3000
if not errorlevel 1 (
    echo [WARN] Port 3000 appears to have active connections.
) else (
    echo [+] Port 3000 is available.
)
echo.

echo ===============================================================================
echo Starting Vite server on http://localhost:3000...
echo ===============================================================================
echo.

node "%~dp0node_modules\vite\bin\vite.js" --port 3000 --host 127.0.0.1 --open

:prompt_keep_open
echo.
echo ===============================================================================
echo Diagnostic run ended. This window is intentionally kept OPEN.
echo ===============================================================================
cmd /k
