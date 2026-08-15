@echo off
REM Bloomberg Terminal Local Launcher Script for Windows

echo ==================================================
echo     Launching Bloomberg Terminal Application...
echo ==================================================

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH.
    pause
    exit /b
)

echo Checking dependencies...
pip install -r requirements.txt --quiet

echo Starting Bloomberg Terminal on http://localhost:8501...
streamlit run streamlit_app.py --server.port=8501 --server.headless=false
pause
