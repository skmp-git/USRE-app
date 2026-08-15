# 📈 Bloomberg Terminal Web Application (Local Desktop Edition)

A high-performance, Bloomberg Terminal-like web application designed to be launched locally from your desktop. Built with Python, Streamlit, Plotly, and yFinance, it replicates the iconic dark/amber terminal aesthetic, command prompt system, function key navigation, real-time financial data, and technical charting.

---

## 🌟 Key Features

- **Iconic Bloomberg Interface**: Classic black & amber color palette with glowing typography, status bars, and monospaced styling.
- **Command Prompt Bar & Function Keys**: Navigate seamlessly via terminal commands (e.g. `AAPL GP <GO>`, `WEI`, `TOP`, `PORT`) or top function shortcut keys (`F1` - `F8`).
- **F2: GP (Graph Plot & Technical Analysis)**: Interactive Plotly candlestick & line charts featuring technical indicators like SMA 20/50/200, Bollinger Bands, Volume, RSI (14), and MACD.
- **F3: DES (Security Description & Statistics)**: Comprehensive business summaries, market capitalization, trailing/forward P/E ratios, 52-week ranges, dividend yields, and trading statistics.
- **F4: FA (Financial Analysis)**: Detailed financial statements including Income Statements, Balance Sheets, and Cash Flow Statements.
- **F5: WEI (World Equity Indices)**: Live overview of global indices (S&P 500, Nasdaq, Dow Jones, FTSE, Nikkei, DAX), commodities (Crude Oil, Gold), crypto (Bitcoin), and forex.
- **F6: TOP (Market News)**: Live financial news feed timestamped with ticker tagging.
- **F7: PORT (Portfolio Monitor & Simulator)**: Interactive position manager tracking shares, buy price, current market value, total unrealized P&L ($ and %), and cost basis.
- **F8: MOST (Market Movers)**: Real-time rankings of top gainers, top losers, and highest volume equities.
- **ECO (Macroeconomic Indicators)**: US Treasury yields, VIX volatility index, interest rates, and commodity futures.

---

## 🚀 How to Launch Locally from Desktop

### Quick Launch (Desktop Launchers)

#### **On Linux / macOS:**
1. Open terminal in the directory or double-click `run.sh`:
   ```bash
   ./run.sh
   ```

#### **On Windows:**
1. Double-click `run.bat` or run in Command Prompt / PowerShell:
   ```cmd
   run.bat
   ```

*Note: `run.bat` automatically searches for Python across system PATH, `py` launcher, and default Windows installation paths (`%LocalAppData%\Programs\Python`, `C:\Python3*`, etc.).*

---

### Manual Launch via Command Line

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt --no-cache-dir
   ```

2. **Start the Application**:
   ```bash
   streamlit run streamlit_app.py
   ```

3. Open your browser and navigate to `http://localhost:8501`.

---

## ❓ Troubleshooting & FAQs

### 1. "Python is not installed or not in PATH"
If you see an error stating Python is not installed or not in PATH when clicking `run.bat`:
- **Re-install or Modify Python Setup**: Download Python from [python.org/downloads](https://www.python.org/downloads/). When running the installer, **ensure you check the box that says "Add python.exe to PATH"** at the bottom of the first screen.
- **Using the Python Launcher (`py`)**: The standard Windows Python installer installs the `py` launcher in `C:\Windows\py.exe` automatically. `run.bat` will detect this automatically even if `python` isn't in your PATH.
- **Manually Adding Python to PATH**: Search for "Edit the system environment variables" in Windows Start menu -> Environment Variables -> Edit `Path` -> Add your Python installation folder.

### 2. "WARNING: Cache entry deserialization failed, entry ignored"
This is a harmless pip cache warning caused by corrupted or incompatible HTTP cache files stored by pip in your local user profile directory.
- **Automated Fix**: The included `run.bat` and `run.sh` launcher scripts pass `--no-cache-dir` to prevent reading/writing to corrupted pip caches.
- **Manual Cache Clear**: If running pip manually, you can purge the pip cache using:
  ```bash
  pip cache purge
  ```

---

## ⌨️ Terminal Command Directory

Type any of the following into the top command prompt and click **`EXECUTE <GO>`**:

| Command | Action |
|---|---|
| `<TICKER> GP` | Open Interactive Technical Chart for ticker (e.g., `AAPL GP`, `NVDA GP`) |
| `<TICKER> DES` | View security description & key metrics (e.g., `MSFT DES`) |
| `<TICKER> FA` | View financial statements (Income statement, Balance sheet) |
| `<TICKER> TOP` | View live news feed related to symbol |
| `WEI` | Launch World Equity Indices & Global Markets view |
| `PORT` | Open Portfolio P&L Manager |
| `MOST` | View Market Movers (Top Gainers, Top Losers, Most Active) |
| `ECO` | View Macroeconomic & Treasury Interest Rate Indicators |
| `HELP` | Display Terminal User Guide & Command List |

---

## 🛠️ Tech Stack

- **Frontend / Application Framework**: [Streamlit](https://streamlit.io)
- **Data Engine & Financial API**: [yfinance](https://github.com/ranaroussi/yfinance) & [Pandas](https://pandas.pydata.org/)
- **Data Visualization**: [Plotly](https://plotly.com/python/)
- **Styling**: Custom CSS (`style.css`) with Google Fonts (`Share Tech Mono`)
