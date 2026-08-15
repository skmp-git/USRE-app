@echo off
SETLOCAL EnableDelayedExpansion

echo ==================================================
echo     Launching Bloomberg Terminal Application...
echo ==================================================

SET "PYTHON_CMD="

:: 1. Check if 'py' launcher exists (installed by default with Windows Python installer)
py --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    SET "PYTHON_CMD=py"
    GOTO PYTHON_FOUND
)

:: 2. Check if 'python' command is available in PATH
python --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    SET "PYTHON_CMD=python"
    GOTO PYTHON_FOUND
)

:: 3. Check if 'python3' command is available in PATH
python3 --version >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    SET "PYTHON_CMD=python3"
    GOTO PYTHON_FOUND
)

:: 4. Search common Windows installation paths if not in PATH
FOR %%P IN (
    "%LocalAppData%\Programs\Python\Python312\python.exe"
    "%LocalAppData%\Programs\Python\Python311\python.exe"
    "%LocalAppData%\Programs\Python\Python310\python.exe"
    "%LocalAppData%\Programs\Python\Python39\python.exe"
    "%ProgramFiles%\Python312\python.exe"
    "%ProgramFiles%\Python311\python.exe"
    "%ProgramFiles%\Python310\python.exe"
    "C:\Python312\python.exe"
    "C:\Python311\python.exe"
    "C:\Python310\python.exe"
) DO (
    IF EXIST %%P (
        SET "PYTHON_CMD=%%P"
        GOTO PYTHON_FOUND
    )
)

:: If Python is still not found, prompt user with instructions
echo [ERROR] Python was not found on your system or PATH!
echo.
echo Quick Solutions:
echo 1. Download and install Python from https://www.python.org/downloads/
echo    IMPORTANT: Make sure to check the box "Add python.exe to PATH" during setup!
echo 2. If Python is already installed, add its directory to your System PATH environment variable.
echo.
pause
exit /b 1

:PYTHON_FOUND
echo Found Python via: %PYTHON_CMD%
echo.

echo Checking dependencies...
%PYTHON_CMD% -m pip install -r requirements.txt --no-cache-dir --disable-pip-version-check --quiet

echo Starting Bloomberg Terminal on http://localhost:8501...
%PYTHON_CMD% -m streamlit run streamlit_app.py --server.port=8501 --server.headless=false

pause
