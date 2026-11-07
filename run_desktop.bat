@echo off
setlocal enableextensions enabledelayedexpansion
:: ===============================================================================
:: Enforce persistent cmd.exe /k session so the window CANNOT silently vanish
:: ===============================================================================
if "%~1" neq "__PERSIST__" (
    start "Fixed Income Portfolio Management Workstation" cmd.exe /k ""%~f0" __PERSIST__ %*"
    exit /b
)
shift

title Fixed Income Portfolio Management Workstation
cd /d "%~dp0"

echo ===============================================================================
echo          FIXED INCOME PORTFOLIO MANAGEMENT WORKSTATION
echo                  Desktop Application Launcher
echo ===============================================================================
echo.

:: -----------------------------------------------------------------------------
:: Step 0: Check if running inside an unextracted ZIP file
:: -----------------------------------------------------------------------------
echo "%~dp0" | findstr /i "AppData\\Local\\Temp" >nul
if %errorlevel% equ 0 (
    echo [WARNING] YOU APPEAR TO BE RUNNING DIRECTLY INSIDE A TEMPORARY / ZIP FOLDER!
    echo Running from an unextracted zip will prevent files from saving properly.
    echo Please EXTRACT this folder to your Desktop or Documents folder before running.
    echo.
)

:: -----------------------------------------------------------------------------
:: Step 1: Detect and augment PATH for common Node.js install locations on Windows
:: -----------------------------------------------------------------------------
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
)
if exist "%APPDATA%\npm" (
    set "PATH=%APPDATA%\npm;%PATH%"
)
if exist "%USERPROFILE%\AppData\Roaming\nvm\current" (
    set "PATH=%USERPROFILE%\AppData\Roaming\nvm\current;%PATH%"
)
if defined NVM_SYMLINK (
    if exist "%NVM_SYMLINK%" (
        set "PATH=%NVM_SYMLINK%;%PATH%"
    )
)
if exist "%USERPROFILE%\.fnm\current" (
    set "PATH=%USERPROFILE%\.fnm\current;%PATH%"
)
if exist "%USERPROFILE%\.volta\bin" (
    set "PATH=%USERPROFILE%\.volta\bin;%PATH%"
)

:: -----------------------------------------------------------------------------
:: Step 2: Validate Node.js presence and working state
:: -----------------------------------------------------------------------------
set "NODE_OK=0"
node -e "console.log(process.version)" >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_OK=1"
)

if "%NODE_OK%" neq "1" (
    echo ===============================================================================
    echo [NOTICE] Node.js is not yet installed or not detected on this system.
    echo ===============================================================================
    echo.
    echo You have TWO options to run this workstation:
    echo.
    echo   [1] Launch INSTANTLY using built-in Windows Standalone Server
    echo       - No installation or downloads needed!
    echo       - Works immediately on all Windows 10 and 11 computers.
    echo.
    echo   [2] Open Node.js download page (https://nodejs.org)
    echo       - Recommended if you are developing or modifying the app.
    echo.
    set "USER_CHOICE=1"
    set /p "USER_CHOICE=Enter 1 or 2 (Default is 1): "
    if "!USER_CHOICE!"=="2" (
        start https://nodejs.org/en/download
        echo.
        echo After installing Node.js, run run_desktop.bat again.
        echo Press any key to exit...
        pause >nul
        exit /b 0
    ) else (
        echo.
        echo Starting Standalone Windows Web Server...
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
        exit /b 0
    )
)

:: Display detected Node version
for /f "tokens=*" %%v in ('node -e "console.log(process.version)"') do set "NODE_VER=%%v"
echo [1/3] Node.js detected: %NODE_VER%

:: -----------------------------------------------------------------------------
:: Step 3: Verify and install dependencies if needed
:: -----------------------------------------------------------------------------
if not exist "%~dp0node_modules\vite\bin\vite.js" (
    echo [2/3] Installing dependencies (first run only, please wait 1-2 minutes)...
    echo.
    cmd.exe /c "npm install"
    if errorlevel 1 (
        echo.
        echo [WARN] 'npm install' encountered an issue.
        echo Falling back to built-in Standalone Windows Server...
        powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
        exit /b 0
    )
    echo Dependencies successfully installed.
) else (
    echo [2/3] Dependencies verified (node_modules ready).
)
echo.

:: -----------------------------------------------------------------------------
:: Step 4: Run Vite Dev Server with direct Node invocation and auto-open
:: -----------------------------------------------------------------------------
echo [3/3] Starting Fixed Income Workstation on http://localhost:3000...
echo.
echo ===============================================================================
echo  STATUS: Workstation Server is RUNNING at http://127.0.0.1:3000
echo.
echo  Your browser window will open automatically.
echo  If it does not open, visit: http://127.0.0.1:3000
echo.
echo  KEEP THIS WINDOW OPEN while using the workstation.
echo  To stop the server, press Ctrl+C in this window.
echo ===============================================================================
echo.

node "%~dp0node_modules\vite\bin\vite.js" --port 3000 --host 127.0.0.1 --open

:: If Vite finishes or is interrupted, the prompt remains permanently open
echo.
echo ===============================================================================
echo Workstation session finished. This prompt window remains open.
echo ===============================================================================
cmd /k
