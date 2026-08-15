# 📈 Bloomberg Terminal Single-Page Financial Research Dashboard

A complete, functional single-page financial research dashboard replicating the iconic Bloomberg Terminal layout, pitch-black dark mode aesthetic, and dense multi-pane grid structure.

---

## 🌟 Key Dashboard Features & Panes

1. **Signature Bloomberg Design**:
   - Pitch-black background (`#000000`), high-contrast glowing amber text (`#FFB000`), neon green (`#00FF66`), neon red (`#FF3333`), and high-contrast window borders.

2. **Top Pane: Real-Time Scrolling Ticker Ribbon**:
   - Scrolling ticker ribbon displaying real-time market indices, commodities, currencies, crypto, and top equities.

3. **Left Pane: Stock Lookup & Fundamentals**:
   - Interactive ticker lookup query pulling live company profile summaries, market capitalization, trailing/forward P/E ratios, 52-week ranges, and dividend yield.

4. **Center Pane: Interactive Financial Chart (Price & Volume)**:
   - Interactive Plotly chart combining price action (Candlesticks, SMA 20, SMA 50) and volume bars across customizable timeframes (1M, 3M, 6M, 1Y, 5Y).

5. **Right Pane: Real-Time Financial News Stream**:
   - Real-time news feed streaming headlines, timestamps, publishers, and ticker tags.

6. **Bottom Pane: SEC Filings Financial Metrics Table**:
   - Data table displaying detailed SEC filings metrics including annual Income Statements and Balance Sheets.

7. **Keyboard Shortcuts & Window Focus**:
   - Command prompt bar and window focus selector allowing quick navigation ('/', 'Esc', numbers 1-4) to switch focus between windows or display all panes in a multi-grid.

8. **429 Rate-Limit Fail-Safe Caching**:
   - Built-in automatic fail-safe caching (`@st.cache_data`) that seamlessly switches to cached data feeds if public API rate limits (HTTP 429) or network delays occur.

---

## 🚀 How to Launch Locally

### Quick Launch (Desktop Launchers)

#### **On Linux / macOS:**
```bash
./run.sh
```

#### **On Windows:**
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

2. **Start the Single-Page Dashboard**:
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

### 2. "WARNING: Cache entry deserialization failed, entry ignored"
This is a harmless pip cache warning caused by corrupted or incompatible HTTP cache files stored by pip in your local user profile directory.
- **Automated Fix**: The included `run.bat` and `run.sh` launcher scripts pass `--no-cache-dir` to prevent reading/writing to corrupted pip caches.
- **Manual Cache Clear**: If running pip manually, you can purge the pip cache using `pip cache purge`.

---

## 🛠️ Tech Stack

- **Application Framework**: [Streamlit](https://streamlit.io)
- **Data Engine & Financial API**: [yfinance](https://github.com/ranaroussi/yfinance) & [Pandas](https://pandas.pydata.org/)
- **Data Visualization**: [Plotly](https://plotly.com/python/)
- **Styling**: Pitch-Black CSS (`style.css`) with Google Fonts (`Share Tech Mono`)
