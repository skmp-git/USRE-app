@echo off
REM Windows BAT Desktop Launcher script for Financial Market Dashboard Application

TITLE Financial Market Dashboard Launcher

echo Checking Python installation...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    pause
    exit /b 1
)

echo Installing/updating dependencies...
python -m pip install --no-cache-dir --disable-pip-version-check -r requirements.txt

echo Launching Financial Market Dashboard...
python -m streamlit run streamlit_app.py

pause
