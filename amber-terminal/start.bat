@echo off
setlocal enabledelayedexpansion
title Amber Terminal Launcher

echo ========================================================
echo               Amber Terminal Launcher
echo ========================================================
echo.

rem ---------------------------------------------------------
rem 1. Locate Amber Terminal folder (containing server.js)
rem ---------------------------------------------------------
set "APP_DIR="

if exist "%~dp0server.js" (
    set "APP_DIR=%~dp0"
) else if exist "%~dp0amber-terminal\server.js" (
    set "APP_DIR=%~dp0amber-terminal"
) else if exist "%USERPROFILE%\Desktop\amber-terminal\server.js" (
    set "APP_DIR=%USERPROFILE%\Desktop\amber-terminal"
) else if exist "%USERPROFILE%\Downloads\amber-terminal\server.js" (
    set "APP_DIR=%USERPROFILE%\Downloads\amber-terminal"
) else if exist "%USERPROFILE%\Documents\amber-terminal\server.js" (
    set "APP_DIR=%USERPROFILE%\Documents\amber-terminal"
)

if not defined APP_DIR (
    echo Searching for Amber Terminal folder on this computer...
    for /f "delims=" %%I in ('where /r "%USERPROFILE%" server.js 2^>nul') do (
        if not defined APP_DIR (
            if exist "%%~dpIserver.js" if exist "%%~dpIpackage.json" set "APP_DIR=%%~dpI"
        )
    )
)

if not defined APP_DIR (
    echo Amber Terminal installation folder was not found.
    echo Downloading a fresh copy into "%~dp0amber-terminal" ...
    cd /d "%~dp0"
    curl.exe -fsSL -o "%TEMP%\amber-terminal.zip" https://part-timequant.com/kit/amber-terminal.zip
    if exist "%TEMP%\amber-terminal.zip" (
        tar.exe -xf "%TEMP%\amber-terminal.zip"
        if exist "%~dp0amber-terminal\server.js" set "APP_DIR=%~dp0amber-terminal"
    )
)

if not defined APP_DIR (
    echo.
    echo [ERROR] Could not locate the amber-terminal folder.
    echo Please ensure the amber-terminal folder is present.
    echo.
    pause
    exit /b 1
)

cd /d "%APP_DIR%"
echo Location: %CD%
echo.

rem ---------------------------------------------------------
rem 2. Locate or Install Node.js
rem ---------------------------------------------------------
set "NODE_CMD="

rem Check if node is available in PATH
where node >nul 2>nul
if !errorlevel! equ 0 (
    set "NODE_CMD=node"
    goto :FOUND_NODE
)

rem Check standard Windows installation directories
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    goto :FOUND_NODE
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :FOUND_NODE
)
if exist "%ProgramW6432%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramW6432%\nodejs\node.exe"
    goto :FOUND_NODE
)
if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\node\node.exe"
    goto :FOUND_NODE
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :FOUND_NODE
)
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe"
    goto :FOUND_NODE
)
if exist "%USERPROFILE%\scoop\shims\node.exe" (
    set "NODE_CMD=%USERPROFILE%\scoop\shims\node.exe"
    goto :FOUND_NODE
)
if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" (
    set "NODE_CMD=%USERPROFILE%\scoop\apps\nodejs\current\node.exe"
    goto :FOUND_NODE
)
if exist "%ALLUSERSPROFILE%\chocolatey\bin\node.exe" (
    set "NODE_CMD=%ALLUSERSPROFILE%\chocolatey\bin\node.exe"
    goto :FOUND_NODE
)
if exist "C:\ProgramData\chocolatey\bin\node.exe" (
    set "NODE_CMD=C:\ProgramData\chocolatey\bin\node.exe"
    goto :FOUND_NODE
)
if exist "C:\nodejs\node.exe" (
    set "NODE_CMD=C:\nodejs\node.exe"
    goto :FOUND_NODE
)

rem Check NVM
if defined NVM_HOME (
    if exist "%NVM_HOME%\node.exe" (
        set "NODE_CMD=%NVM_HOME%\node.exe"
        goto :FOUND_NODE
    )
)
if exist "%APPDATA%\nvm" (
    for /d %%D in ("%APPDATA%\nvm\v*") do (
        if exist "%%D\node.exe" (
            set "NODE_CMD=%%D\node.exe"
            goto :FOUND_NODE
        )
    )
)

rem Node not found: try installing via winget or prompt user
echo Node.js 18 or newer is required to run Amber Terminal.
echo Node.js was not detected in system PATH or standard folders.
echo.

where winget >nul 2>nul
if !errorlevel! equ 0 (
    echo Attempting to install Node.js LTS via winget...
    winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
    echo.
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
        goto :FOUND_NODE
    )
    if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
        goto :FOUND_NODE
    )
    where node >nul 2>nul
    if !errorlevel! equ 0 (
        set "NODE_CMD=node"
        goto :FOUND_NODE
    )
)

echo Please install Node.js (version 18 or newer) from:
echo   https://nodejs.org
echo.
echo Opening https://nodejs.org in your browser...
start https://nodejs.org
echo Once installed, double-click this launcher again.
echo.
pause
exit /b 1

:FOUND_NODE
echo Using Node.js: "!NODE_CMD!"
for %%F in ("!NODE_CMD!") do set "NODE_DIR=%%~dpF"
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"

rem ---------------------------------------------------------
rem 3. Create shortcut on Desktop if available
rem ---------------------------------------------------------
if exist "%USERPROFILE%\Desktop" (
    if not exist "%USERPROFILE%\Desktop\Amber Terminal.bat" (
        (
            echo @echo off
            echo cd /d "%APP_DIR%"
            echo call start.bat
        ) > "%USERPROFILE%\Desktop\Amber Terminal.bat" 2>nul
    )
)

rem ---------------------------------------------------------
rem 4. Start Amber Terminal & Open Browser
rem ---------------------------------------------------------
echo.
echo Starting Amber Terminal server...

if exist "scripts\launch.js" (
    "!NODE_CMD!" scripts\launch.js
) else (
    start "" "!NODE_CMD!" server.js --open
)

rem Explicitly open default browser to Amber Terminal
timeout /t 1 /nobreak >nul
echo Opening Amber Terminal in your browser at http://localhost:3787 ...
start http://localhost:3787

echo.
echo ========================================================
echo   Amber Terminal is running!
echo   Address: http://localhost:3787
echo.
echo   Press Ctrl+C or run "node scripts\stop.js" to stop.
echo ========================================================
echo.
echo You can keep this window open or press any key to close it.
pause
