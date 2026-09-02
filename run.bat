@echo off
title Systematic Fixed Income Portfolio App Launcher
echo ========================================================
echo Launching Systematic Fixed Income Portfolio Engine...
echo ========================================================

:: Check for python installation
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH. Please install Python and try again.
    pause
    exit /b 1
)

echo Installing / updating required packages...
python -m pip install -r requirements.txt --no-cache-dir --disable-pip-version-check

echo Starting Streamlit App...
python -m streamlit run streamlit_app.py

pause
