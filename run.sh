#!/bin/bash
# Bloomberg Terminal Local Launcher Script for Linux / macOS

echo "=================================================="
echo "    Launching Bloomberg Terminal Application...   "
echo "=================================================="

# Check Python installation
if ! command -v python3 &> /dev/null
then
    echo "Python3 could not be found. Please install Python 3."
    exit 1
fi

# Install requirements if needed
echo "Checking dependencies..."
pip install -r requirements.txt --quiet

# Launch Streamlit app
echo "Starting Bloomberg Terminal on http://localhost:8501..."
streamlit run streamlit_app.py --server.port=8501 --server.headless=false
