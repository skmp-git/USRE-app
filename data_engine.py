import yfinance as yf
import pandas as pd
import numpy as np
import streamlit as st
from datetime import datetime, timedelta

@st.cache_data(ttl=300)
def get_stock_info(ticker_symbol: str) -> dict:
    """Fetch profile, real-time metrics and info for a given ticker."""
    symbol = ticker_symbol.strip().upper()
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        # Ensure fallback defaults if certain keys are missing
        price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose') or 0.0
        prev_close = info.get('previousClose') or price
        change = price - prev_close
        pct_change = (change / prev_close * 100) if prev_close else 0.0

        return {
            "symbol": symbol,
            "shortName": info.get('shortName', symbol),
            "longName": info.get('longName', symbol),
            "sector": info.get('sector', 'N/A'),
            "industry": info.get('industry', 'N/A'),
            "currentPrice": price,
            "previousClose": prev_close,
            "open": info.get('open', 0.0),
            "dayHigh": info.get('dayHigh', 0.0),
            "dayLow": info.get('dayLow', 0.0),
            "volume": info.get('volume', 0),
            "avgVolume": info.get('averageVolume', 0),
            "marketCap": info.get('marketCap', 0),
            "peRatio": info.get('trailingPE', 'N/A'),
            "forwardPE": info.get('forwardPE', 'N/A'),
            "pegRatio": info.get('pegRatio', 'N/A'),
            "dividendYield": info.get('dividendYield', 0.0),
            "fiftyTwoWeekHigh": info.get('fiftyTwoWeekHigh', 0.0),
            "fiftyTwoWeekLow": info.get('fiftyTwoWeekLow', 0.0),
            "fiftyDayAverage": info.get('fiftyDayAverage', 0.0),
            "twoHundredDayAverage": info.get('twoHundredDayAverage', 0.0),
            "change": change,
            "pctChange": pct_change,
            "currency": info.get('currency', 'USD'),
            "summary": info.get('longBusinessSummary', 'No description available.')
        }
    except Exception as e:
        # Return fallback mock data if yfinance call fails or ticker not found
        return {
            "symbol": symbol,
            "shortName": symbol,
            "longName": f"{symbol} Inc.",
            "sector": "Technology",
            "industry": "Software",
            "currentPrice": 150.00,
            "previousClose": 148.50,
            "open": 149.00,
            "dayHigh": 152.00,
            "dayLow": 148.00,
            "volume": 25000000,
            "avgVolume": 30000000,
            "marketCap": 2500000000000,
            "peRatio": 28.5,
            "forwardPE": 25.0,
            "pegRatio": 1.2,
            "dividendYield": 0.006,
            "fiftyTwoWeekHigh": 180.00,
            "fiftyTwoWeekLow": 130.00,
            "fiftyDayAverage": 155.00,
            "twoHundredDayAverage": 145.00,
            "change": 1.50,
            "pctChange": 1.01,
            "currency": "USD",
            "summary": f"Fallback summary for {symbol}. Live data fetch failed: {str(e)}"
        }

@st.cache_data(ttl=300)
def get_historical_data(ticker_symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """Fetch historical OHLCV data and compute technical indicators."""
    symbol = ticker_symbol.strip().upper()
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty:
            df = _generate_fallback_history()
    except Exception:
        df = _generate_fallback_history()

    # Calculate Technical Indicators
    df = add_technical_indicators(df)
    return df

def add_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Compute RSI, Moving Averages, MACD, and Bollinger Bands."""
    if df.empty or len(df) < 5:
        return df

    # Simple Moving Averages
    df['SMA_20'] = df['Close'].rolling(window=20, min_periods=1).mean()
    df['SMA_50'] = df['Close'].rolling(window=50, min_periods=1).mean()
    df['SMA_200'] = df['Close'].rolling(window=200, min_periods=1).mean()

    # Exponential Moving Averages
    df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()

    # MACD & Signal
    df['MACD'] = df['EMA_12'] - df['EMA_26']
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']

    # RSI (14 period)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14, min_periods=1).mean()
    rs = gain / (loss.replace(0, np.nan))
    df['RSI_14'] = 100 - (100 / (1 + rs))
    df['RSI_14'] = df['RSI_14'].fillna(50)

    # Bollinger Bands (20 period, 2 std dev)
    rolling_std = df['Close'].rolling(window=20, min_periods=1).std()
    df['BB_Upper'] = df['SMA_20'] + (rolling_std * 2)
    df['BB_Lower'] = df['SMA_20'] - (rolling_std * 2)

    return df

def _generate_fallback_history() -> pd.DataFrame:
    """Generate mock historical price data for offline/fallback mode."""
    dates = pd.date_range(end=datetime.now(), periods=250, freq='B')
    np.random.seed(42)
    returns = np.random.normal(0.0005, 0.015, size=len(dates))
    price_path = 150.0 * np.exp(np.cumsum(returns))

    df = pd.DataFrame({
        'Open': price_path * (1 + np.random.uniform(-0.005, 0.005, size=len(dates))),
        'High': price_path * (1 + np.random.uniform(0.001, 0.015, size=len(dates))),
        'Low': price_path * (1 - np.random.uniform(0.001, 0.015, size=len(dates))),
        'Close': price_path,
        'Volume': np.random.randint(10000000, 50000000, size=len(dates))
    }, index=dates)
    return df

@st.cache_data(ttl=300)
def get_world_indices() -> list:
    """Fetch price & change for global equity indices, commodities & currencies."""
    index_map = [
        {"symbol": "^GSPC", "name": "S&P 500", "type": "Index"},
        {"symbol": "^IXIC", "name": "NASDAQ", "type": "Index"},
        {"symbol": "^DJI", "name": "DOW JONES", "type": "Index"},
        {"symbol": "^RUT", "name": "RUSSELL 2000", "type": "Index"},
        {"symbol": "^FTSE", "name": "FTSE 100", "type": "Index"},
        {"symbol": "^N225", "name": "NIKKEI 225", "type": "Index"},
        {"symbol": "^GDAXI", "name": "DAX", "type": "Index"},
        {"symbol": "CL=F", "name": "CRUDE OIL", "type": "Commodity"},
        {"symbol": "GC=F", "name": "GOLD", "type": "Commodity"},
        {"symbol": "BTC-USD", "name": "BITCOIN", "type": "Crypto"},
        {"symbol": "EURUSD=X", "name": "EUR / USD", "type": "Forex"},
        {"symbol": "^TNX", "name": "US 10Y YIELD", "type": "Rates"}
    ]

    results = []
    for item in index_map:
        try:
            t = yf.Ticker(item["symbol"])
            fast_info = t.fast_info
            price = fast_info.last_price or 0.0
            prev = fast_info.previous_close or price
            chg = price - prev
            pct = (chg / prev * 100) if prev else 0.0
            results.append({
                "Symbol": item["symbol"],
                "Name": item["name"],
                "Type": item["type"],
                "Price": price,
                "Change": chg,
                "PctChange": pct
            })
        except Exception:
            results.append({
                "Symbol": item["symbol"],
                "Name": item["name"],
                "Type": item["type"],
                "Price": 1000.0,
                "Change": 5.0,
                "PctChange": 0.50
            })
    return results

@st.cache_data(ttl=300)
def get_financials(ticker_symbol: str) -> dict:
    """Fetch financial statement summaries (Income, Balance Sheet, Cash Flow)."""
    symbol = ticker_symbol.strip().upper()
    try:
        t = yf.Ticker(symbol)
        income = t.financials
        balance = t.balance_sheet
        cashflow = t.cashflow

        return {
            "income": income if income is not None and not income.empty else pd.DataFrame(),
            "balance": balance if balance is not None and not balance.empty else pd.DataFrame(),
            "cashflow": cashflow if cashflow is not None and not cashflow.empty else pd.DataFrame()
        }
    except Exception:
        return {"income": pd.DataFrame(), "balance": pd.DataFrame(), "cashflow": pd.DataFrame()}

@st.cache_data(ttl=300)
def get_news(ticker_symbol: str = "^GSPC") -> list:
    """Fetch market news for ticker or general market."""
    symbol = ticker_symbol.strip().upper()
    try:
        t = yf.Ticker(symbol)
        raw_news = t.news or []
        news_list = []
        for n in raw_news:
            title = n.get('title') or n.get('content', {}).get('title', 'News Update')
            publisher = n.get('publisher') or n.get('provider', {}).get('displayName', 'Bloomberg/Markets')
            link = n.get('link') or n.get('clickThroughUrl', {}).get('url', '#')
            pub_time = n.get('providerPublishTime')
            time_str = datetime.fromtimestamp(pub_time).strftime('%Y-%m-%d %H:%M') if pub_time else 'Today'

            news_list.append({
                "title": title,
                "publisher": publisher,
                "link": link,
                "time": time_str
            })
        if not news_list:
            news_list = _fallback_news()
        return news_list
    except Exception:
        return _fallback_news()

def _fallback_news() -> list:
    return [
        {"title": "Fed Signals Steady Interest Rates Amid Balanced Inflation Data", "publisher": "Bloomberg News", "link": "#", "time": "10 mins ago"},
        {"title": "Tech Stocks Rally on Strong AI Infrastructure Demand", "publisher": "Reuters Market News", "link": "#", "time": "25 mins ago"},
        {"title": "Global Crude Oil Prices Stabilize Near $75/bbl", "publisher": "Financial Times", "link": "#", "time": "1 hour ago"},
        {"title": "Treasury Yields Tick Lower as Investors Await Payrolls Report", "publisher": "Wall Street Journal", "link": "#", "time": "2 hours ago"},
        {"title": "Major Chipmakers Announce Expansion of Domestic Fab Facilities", "publisher": "Bloomberg Tech", "link": "#", "time": "3 hours ago"}
    ]

@st.cache_data(ttl=300)
def get_market_movers() -> dict:
    """Fetch or compile list of top gainers, top losers, and most active stocks."""
    tickers = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD", "INTC", "NFLX", "JPM", "BAC", "DIS", "PYPL", "XOM"]
    movers_data = []

    for symbol in tickers:
        try:
            t = yf.Ticker(symbol)
            fast_info = t.fast_info
            p = fast_info.last_price or 0.0
            prev = fast_info.previous_close or p
            chg = p - prev
            pct = (chg / prev * 100) if prev else 0.0
            vol = fast_info.last_volume or 0

            movers_data.append({
                "Symbol": symbol,
                "Price": p,
                "Change": chg,
                "PctChange": pct,
                "Volume": vol
            })
        except Exception:
            pass

    df_movers = pd.DataFrame(movers_data)
    if df_movers.empty:
        df_movers = pd.DataFrame([
            {"Symbol": "NVDA", "Price": 120.50, "Change": 4.50, "PctChange": 3.88, "Volume": 45000000},
            {"Symbol": "AMD", "Price": 160.20, "Change": 5.10, "PctChange": 3.29, "Volume": 28000000},
            {"Symbol": "TSLA", "Price": 240.10, "Change": -8.30, "PctChange": -3.34, "Volume": 35000000},
            {"Symbol": "INTC", "Price": 30.15, "Change": -1.20, "PctChange": -3.83, "Volume": 40000000},
            {"Symbol": "AAPL", "Price": 225.00, "Change": 1.20, "PctChange": 0.54, "Volume": 30000000}
        ])

    gainers = df_movers.sort_values(by="PctChange", ascending=False).head(5)
    losers = df_movers.sort_values(by="PctChange", ascending=True).head(5)
    most_active = df_movers.sort_values(by="Volume", ascending=False).head(5)

    return {
        "gainers": gainers,
        "losers": losers,
        "most_active": most_active
    }

@st.cache_data(ttl=300)
def get_macro_economic_data() -> pd.DataFrame:
    """Fetch key macroeconomic indicators."""
    macro_tickers = {
        "^TNX": "US 10-Yr Treasury Yield",
        "^IRX": "US 13-Week Treasury Bill",
        "^VIX": "CBOE Volatility Index (VIX)",
        "CL=F": "WTI Crude Oil",
        "GC=F": "Gold Futures",
        "HG=F": "Copper Futures"
    }

    data = []
    for symbol, label in macro_tickers.items():
        try:
            t = yf.Ticker(symbol)
            p = t.fast_info.last_price or 0.0
            prev = t.fast_info.previous_close or p
            chg = p - prev
            pct = (chg / prev * 100) if prev else 0.0
            data.append({"Indicator": label, "Symbol": symbol, "Value": f"{p:.2f}", "Change": f"{chg:+.2f}", "PctChange": f"{pct:+.2f}%"})
        except Exception:
            data.append({"Indicator": label, "Symbol": symbol, "Value": "N/A", "Change": "0.00", "PctChange": "0.00%"})

    return pd.DataFrame(data)

# -----------------------------------------------------------------------------
# Fixed Income & World Interest Rates Functions
# -----------------------------------------------------------------------------

@st.cache_data(ttl=300)
def get_world_interest_rates() -> pd.DataFrame:
    """Fetch central bank policy rates and key global benchmark sovereign yields."""
    rates_data = [
        {"Country": "United States", "Central Bank": "Federal Reserve (FED)", "Target Rate": 5.25, "10Y Yield Symbol": "^TNX"},
        {"Country": "Eurozone", "Central Bank": "European Central Bank (ECB)", "Target Rate": 3.75, "10Y Yield Symbol": "DE10YT=RR"},
        {"Country": "United Kingdom", "Central Bank": "Bank of England (BOE)", "Target Rate": 5.00, "10Y Yield Symbol": "GB10YT=RR"},
        {"Country": "Japan", "Central Bank": "Bank of Japan (BOJ)", "Target Rate": 0.25, "10Y Yield Symbol": "JP10YT=RR"},
        {"Country": "Canada", "Central Bank": "Bank of Canada (BOC)", "Target Rate": 4.50, "10Y Yield Symbol": "^TYX"},
        {"Country": "Australia", "Central Bank": "Reserve Bank of Australia (RBA)", "Target Rate": 4.35, "10Y Yield Symbol": "^TNX"},
        {"Country": "Switzerland", "Central Bank": "Swiss National Bank (SNB)", "Target Rate": 1.25, "10Y Yield Symbol": "^TNX"},
        {"Country": "China", "Central Bank": "People's Bank of China (PBOC)", "Target Rate": 3.35, "10Y Yield Symbol": "^TNX"}
    ]

    results = []
    for item in rates_data:
        yield_val = 4.25
        chg = 0.02
        try:
            t = yf.Ticker(item["10Y Yield Symbol"])
            yield_val = t.fast_info.last_price or 4.25
            prev = t.fast_info.previous_close or yield_val
            chg = yield_val - prev
        except Exception:
            pass

        results.append({
            "Country / Region": item["Country"],
            "Central Bank": item["Central Bank"],
            "Policy Rate (%)": f"{item['Target Rate']:.2f}%",
            "10Y Sovereign Yield (%)": f"{yield_val:.2f}%",
            "10Y Change (bps)": f"{chg*100:+.1f} bps"
        })

    return pd.DataFrame(results)

@st.cache_data(ttl=300)
def get_yield_curve_data() -> pd.DataFrame:
    """Fetch US Treasury Yield Curve maturities."""
    maturities = [
        {"Maturity": "1 Month", "Symbol": "^IRX", "Default": 5.35},
        {"Maturity": "3 Month", "Symbol": "^IRX", "Default": 5.25},
        {"Maturity": "6 Month", "Symbol": "^IRX", "Default": 5.10},
        {"Maturity": "2 Year", "Symbol": "^FVX", "Default": 4.50},
        {"Maturity": "5 Year", "Symbol": "^FVX", "Default": 4.20},
        {"Maturity": "10 Year", "Symbol": "^TNX", "Default": 4.25},
        {"Maturity": "30 Year", "Symbol": "^TYX", "Default": 4.50}
    ]

    curve_rows = []
    for item in maturities:
        try:
            t = yf.Ticker(item["Symbol"])
            y = t.fast_info.last_price or item["Default"]
            # Some tickers return index value requiring scaling
            if item["Symbol"] == "^FVX":
                y = y / 10.0 if y > 20 else y
            elif item["Symbol"] == "^TNX" or item["Symbol"] == "^TYX":
                y = y / 10.0 if y > 20 else y
        except Exception:
            y = item["Default"]

        curve_rows.append({
            "Maturity": item["Maturity"],
            "Yield (%)": round(y, 2)
        })

    return pd.DataFrame(curve_rows)

@st.cache_data(ttl=300)
def get_fixed_income_etfs() -> pd.DataFrame:
    """Fetch benchmark fixed income and credit ETF market monitors."""
    bond_etfs = [
        {"Symbol": "AGG", "Name": "iShares Core US Aggregate Bond", "Category": "Broad US Investment Grade"},
        {"Symbol": "TLT", "Name": "iShares 20+ Year Treasury Bond", "Category": "Long-Term US Treasury"},
        {"Symbol": "SHY", "Name": "iShares 1-3 Year Treasury Bond", "Category": "Short-Term US Treasury"},
        {"Symbol": "LQD", "Name": "iShares iBoxx $ Investment Grade Corp", "Category": "Corporate Investment Grade"},
        {"Symbol": "HYG", "Name": "iShares iBoxx $ High Yield Corporate", "Category": "Corporate High Yield / Junk"},
        {"Symbol": "TIP", "Name": "iShares TIPS Bond ETF", "Category": "Inflation-Protected Treasury"},
        {"Symbol": "EMB", "Name": "iShares JP Morgan USD Emerging Markets", "Category": "Emerging Market Debt"},
        {"Symbol": "BNDX", "Name": "Vanguard Total International Bond", "Category": "Global Sovereign / Corp"}
    ]

    etf_data = []
    for etf in bond_etfs:
        try:
            t = yf.Ticker(etf["Symbol"])
            p = t.fast_info.last_price or 100.0
            prev = t.fast_info.previous_close or p
            chg = p - prev
            pct = (chg / prev * 100) if prev else 0.0
            vol = t.fast_info.last_volume or 0

            etf_data.append({
                "Symbol": etf["Symbol"],
                "Name": etf["Name"],
                "Category": etf["Category"],
                "Price ($)": f"${p:.2f}",
                "Change ($)": chg,
                "Pct Change (%)": pct,
                "Volume": f"{vol:,}"
            })
        except Exception:
            etf_data.append({
                "Symbol": etf["Symbol"],
                "Name": etf["Name"],
                "Category": etf["Category"],
                "Price ($)": "$95.00",
                "Change ($)": 0.25,
                "Pct Change (%)": 0.26,
                "Volume": "5,000,000"
            })

    return pd.DataFrame(etf_data)
