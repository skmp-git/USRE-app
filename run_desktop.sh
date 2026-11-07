#!/usr/bin/env bash
# Fixed Income Portfolio Management Workstation - Desktop Launcher (macOS & Linux)

echo "==============================================================================="
echo "         FIXED INCOME PORTFOLIO MANAGEMENT WORKSTATION"
echo "                 Desktop Application Launcher"
echo "==============================================================================="
echo ""

cd "$(dirname "$0")"

# 1. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not found on your system PATH!"
    echo "Please download and install Node.js (LTS version) from: https://nodejs.org/"
    exit 1
fi

echo "[1/3] Node.js environment detected: $(node --version)"

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    echo "[2/3] node_modules not found. Installing dependencies..."
    npm install
else
    echo "[2/3] Dependencies verified."
fi

# 3. Open browser
echo "[3/3] Starting Fixed Income Portfolio Workstation on http://localhost:3000..."
(
    sleep 2
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:3000"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "http://localhost:3000" || sensible-browser "http://localhost:3000"
    fi
) &

npm run dev
