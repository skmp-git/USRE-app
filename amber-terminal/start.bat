@echo off
setlocal enabledelayedexpansion
title Amber Terminal Launcher

rem Set target directory to amber-terminal folder
if exist "%~dp0server.js" (
    cd /d "%~dp0"
) else if exist "%~dp0amber-terminal\server.js" (
    cd /d "%~dp0amber-terminal"
)

rem 1. Check if node is directly available in PATH
set "NODE_CMD="
where node >nul 2>nul
if %errorlevel% equ 0 (
    set "NODE_CMD=node"
    goto :RUN_NODE
)

rem 2. Check standard Windows installation paths
if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    goto :RUN_NODE
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    goto :RUN_NODE
)
if exist "%ProgramW6432%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramW6432%\nodejs\node.exe"
    goto :RUN_NODE
)
if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\node\node.exe"
    goto :RUN_NODE
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    goto :RUN_NODE
)
if exist "%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Microsoft\WinGet\Links\node.exe"
    goto :RUN_NODE
)
if exist "%USERPROFILE%\scoop\shims\node.exe" (
    set "NODE_CMD=%USERPROFILE%\scoop\shims\node.exe"
    goto :RUN_NODE
)
if exist "%USERPROFILE%\scoop\apps\nodejs\current\node.exe" (
    set "NODE_CMD=%USERPROFILE%\scoop\apps\nodejs\current\node.exe"
    goto :RUN_NODE
)
if exist "%ALLUSERSPROFILE%\chocolatey\bin\node.exe" (
    set "NODE_CMD=%ALLUSERSPROFILE%\chocolatey\bin\node.exe"
    goto :RUN_NODE
)
if exist "C:\ProgramData\chocolatey\bin\node.exe" (
    set "NODE_CMD=C:\ProgramData\chocolatey\bin\node.exe"
    goto :RUN_NODE
)
if exist "C:\nodejs\node.exe" (
    set "NODE_CMD=C:\nodejs\node.exe"
    goto :RUN_NODE
)

rem 3. Check NVM installations
if defined NVM_HOME (
    if exist "%NVM_HOME%\node.exe" (
        set "NODE_CMD=%NVM_HOME%\node.exe"
        goto :RUN_NODE
    )
)
if exist "%APPDATA%\nvm" (
    for /d %%D in ("%APPDATA%\nvm\v*") do (
        if exist "%%D\node.exe" (
            set "NODE_CMD=%%D\node.exe"
            goto :RUN_NODE
        )
    )
)

rem 4. Node was not found in standard paths - attempt auto-install or guide user
echo ========================================================
echo  Node.js was not detected on this computer.
echo  Amber Terminal requires Node.js (version 18 or newer).
echo ========================================================
echo.

where winget >nul 2>nul
if %errorlevel% equ 0 (
    echo Attempting automatic installation using Windows Package Manager (winget)...
    echo Command: winget install --id OpenJS.NodeJS.LTS -e
    echo.
    winget install --id OpenJS.NodeJS.LTS -e
    echo.
    echo Re-checking for Node.js after installation...
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
        goto :RUN_NODE
    )
    if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
        goto :RUN_NODE
    )
    where node >nul 2>nul
    if %errorlevel% equ 0 (
        set "NODE_CMD=node"
        goto :RUN_NODE
    )
)

echo.
echo Please install Node.js (LTS version 18 or newer) from:
echo   https://nodejs.org
echo.
echo Opening https://nodejs.org in your web browser...
start https://nodejs.org
echo Once installed, please run this launcher again.
echo.
pause
exit /b 1

:RUN_NODE
rem Add node's folder to session PATH if not already in PATH
for %%F in ("!NODE_CMD!") do set "NODE_DIR=%%~dpF"
if defined NODE_DIR set "PATH=%NODE_DIR%;%PATH%"

echo Starting Amber Terminal...
"!NODE_CMD!" server.js --open
if %errorlevel% neq 0 (
    echo.
    echo Amber Terminal stopped or encountered an issue.
    pause
)
