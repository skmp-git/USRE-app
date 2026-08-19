#!/usr/bin/env bash
# Shell launcher script for Financial Market Dashboard Application

# Find Python executable
if command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
elif command -v python &>/dev/null; then
    PYTHON_BIN="python"
else
    echo "Error: Python installation not found."
    exit 1
fi

echo "Starting Financial Market Dashboard..."
$PYTHON_BIN -m pip install -q --no-cache-dir --disable-pip-version-check -r requirements.txt
$PYTHON_BIN -m streamlit run streamlit_app.py --server.port=8501 --server.address=0.0.0.0
