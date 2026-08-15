#!/bin/bash
# Bloomberg Terminal Local Launcher Script for Linux / macOS

echo "=================================================="
echo "    Launching Bloomberg Terminal Application...   "
echo "=================================================="

PYTHON_CMD=""

if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
elif command -v py &> /dev/null; then
    PYTHON_CMD="py"
fi

if [ -z "$PYTHON_CMD" ]; then
    echo "[ERROR] Python could not be found. Please install Python 3 (https://www.python.org/)."
    exit 1
fi

echo "Found Python via: $PYTHON_CMD"
echo "Checking dependencies..."
$PYTHON_CMD -m pip install -r requirements.txt --quiet

echo "Starting Bloomberg Terminal on http://localhost:8501..."
$PYTHON_CMD -m streamlit run streamlit_app.py --server.port=8501 --server.headless=false
