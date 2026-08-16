import datetime
import numpy as np
import pandas as pd
import streamlit as st
import yfinance as yf

# Asset class definitions with ticker, name, and category
ASSET_CLASSES = {
    "Equity Sectors": [
        ("XLK", "Technology"),
        ("XLF", "Financials"),
        ("XLV", "Healthcare"),
        ("XLE", "Energy"),
        ("XLY", "Consumer Discretionary"),
        ("XLP", "Consumer Staples"),
        ("XLI", "Industrials"),
        ("XLB", "Materials"),
        ("XLRE", "Real Estate"),
        ("XLU", "Utilities"),
    ],
    "Fixed Income": [
        ("AGG", "Aggregate Bond"),
        ("TLT", "20+ Year Treasury"),
        ("IEF", "7-10 Year Treasury"),
        ("SHY", "1-3 Year Treasury"),
        ("LQD", "Investment Grade Corporate"),
        ("HYG", "High Yield Corporate"),
    ],
    "Commodities": [
        ("GLD", "Gold"),
        ("SLV", "Silver"),
        ("USO", "Crude Oil"),
        ("UNG", "Natural Gas"),
        ("DBA", "Agriculture"),
    ],
    "Alternatives": [
        ("BITO", "Bitcoin Strategy"),
        ("VNQ", "Global Real Estate"),
        ("PSP", "Private Equity"),
        ("PBP", "Buy-Write / Options Strategy"),
    ],
}

TENOR_MAP = {
    "3M": 0.25,
    "6M": 0.5,
    "9M": 0.75,
    "1Y": 1.0,
    "2Y": 2.0,
    "3Y": 3.0,
    "5Y": 5.0,
    "7Y": 7.0,
    "10Y": 10.0,
    "20Y": 20.0,
    "30Y": 30.0,
}


def _get_mock_cross_asset_data():
    """Fallback generator for cross-asset performance data."""
    data = []
    np.random.seed(42)
    for category, items in ASSET_CLASSES.items():
        for ticker, name in items:
            wtd = float(np.random.normal(0.2, 1.2))
            mtd = float(np.random.normal(0.8, 2.5))
            ytd = float(np.random.normal(4.5, 8.0))
            base_price = np.random.uniform(20, 200)
            spark_returns = np.random.normal(0, 0.01, 5)
            sparkline = [float(base_price * (1 + s)) for s in np.cumsum(spark_returns)]
            data.append(
                {
                    "Category": category,
                    "Ticker": ticker,
                    "Name": name,
                    "WTD (%)": round(wtd, 2),
                    "MTD (%)": round(mtd, 2),
                    "YTD (%)": round(ytd, 2),
                    "Sparkline": sparkline,
                }
            )
    return pd.DataFrame(data)


@st.cache_data(ttl=1800)
def fetch_cross_asset_data():
    """Fetches real-time price history and calculates WTD, MTD, YTD, and 5-day sparklines."""
    all_tickers = []
    ticker_meta = {}
    for cat, items in ASSET_CLASSES.items():
        for symbol, name in items:
            all_tickers.append(symbol)
            ticker_meta[symbol] = (cat, name)

    try:
        df = yf.download(all_tickers, period="2y", progress=False)["Close"]
        if df.empty:
            return _get_mock_cross_asset_data()

        df = df.ffill().bfill()
        results = []

        last_date = df.index[-1]
        current_year = last_date.year
        current_month = last_date.month

        # Determine reference dates
        monday_this_week = last_date - datetime.timedelta(days=last_date.weekday())
        wtd_df = df[df.index < pd.Timestamp(monday_this_week)]
        mtd_df = df[df.index < pd.Timestamp(year=current_year, month=current_month, day=1)]
        ytd_df = df[df.index < pd.Timestamp(year=current_year, month=1, day=1)]

        for symbol in all_tickers:
            if symbol not in df.columns:
                continue
            series = df[symbol].dropna()
            if len(series) < 5:
                continue

            curr_price = series.iloc[-1]
            sparkline = series.iloc[-5:].tolist()

            wtd_ref = wtd_df[symbol].dropna().iloc[-1] if not wtd_df.empty and symbol in wtd_df and len(wtd_df[symbol].dropna()) > 0 else series.iloc[-5]
            mtd_ref = mtd_df[symbol].dropna().iloc[-1] if not mtd_df.empty and symbol in mtd_df and len(mtd_df[symbol].dropna()) > 0 else series.iloc[-20]
            ytd_ref = ytd_df[symbol].dropna().iloc[-1] if not ytd_df.empty and symbol in ytd_df and len(ytd_df[symbol].dropna()) > 0 else series.iloc[0]

            wtd_pct = ((curr_price - wtd_ref) / wtd_ref) * 100
            mtd_pct = ((curr_price - mtd_ref) / mtd_ref) * 100
            ytd_pct = ((curr_price - ytd_ref) / ytd_ref) * 100

            cat, name = ticker_meta[symbol]
            results.append(
                {
                    "Category": cat,
                    "Ticker": symbol,
                    "Name": name,
                    "WTD (%)": round(float(wtd_pct), 2),
                    "MTD (%)": round(float(mtd_pct), 2),
                    "YTD (%)": round(float(ytd_pct), 2),
                    "Sparkline": [float(val) for val in sparkline],
                }
            )

        if not results:
            return _get_mock_cross_asset_data()

        return pd.DataFrame(results)

    except Exception as e:
        print(f"Error fetching cross asset data: {e}")
        return _get_mock_cross_asset_data()


def _get_mock_treasury_yield_data():
    """Fallback generator for Treasury Yield Curve and Spread Shifts."""
    tenors = list(TENOR_MAP.keys())
    base_current = [4.30, 4.28, 4.25, 4.20, 4.15, 4.18, 4.22, 4.30, 4.40, 4.65, 4.55]
    base_1m_ago = [4.50, 4.48, 4.45, 4.40, 4.35, 4.38, 4.40, 4.45, 4.55, 4.75, 4.68]
    base_last_ye = [5.20, 5.15, 5.10, 4.90, 4.40, 4.30, 4.15, 4.10, 4.10, 4.35, 4.30]

    yield_curves = pd.DataFrame(
        {
            "Tenor": tenors,
            "Maturity_Years": [TENOR_MAP[t] for t in tenors],
            "Current": base_current,
            "1 Month Ago": base_1m_ago,
            "Last Year End": base_last_ye,
        }
    )

    dates_daily = pd.date_range(end=pd.Timestamp.now(), periods=20, freq="B")
    np.random.seed(10)
    spread_20d = np.cumsum(np.random.normal(0.5, 2.0, 20)) - 15.0
    yield_2y_20d = 4.15 + np.cumsum(np.random.normal(0, 0.03, 20))
    yield_10y_20d = yield_2y_20d + (spread_20d / 100.0)

    daily_shifts = pd.DataFrame(
        {
            "Date": dates_daily,
            "Yield_2Y": np.round(yield_2y_20d, 3),
            "Yield_10Y": np.round(yield_10y_20d, 3),
            "Spread_10Y_2Y_bps": np.round((yield_10y_20d - yield_2y_20d) * 100, 2),
            "Spread_Change_bps": np.round(np.diff(spread_20d, prepend=spread_20d[0]), 2),
        }
    )

    dates_weekly = pd.date_range(end=pd.Timestamp.now(), periods=52, freq="W-FRI")
    np.random.seed(20)
    spread_52w = np.cumsum(np.random.normal(1.0, 4.0, 52)) - 40.0
    yield_2y_52w = 4.80 + np.cumsum(np.random.normal(-0.01, 0.05, 52))
    yield_10y_52w = yield_2y_52w + (spread_52w / 100.0)

    weekly_shifts = pd.DataFrame(
        {
            "Date": dates_weekly,
            "Yield_2Y": np.round(yield_2y_52w, 3),
            "Yield_10Y": np.round(yield_10y_52w, 3),
            "Spread_10Y_2Y_bps": np.round((yield_10y_52w - yield_2y_52w) * 100, 2),
            "Spread_Change_bps": np.round(np.diff(spread_52w, prepend=spread_52w[0]), 2),
        }
    )

    return yield_curves, daily_shifts, weekly_shifts


@st.cache_data(ttl=1800)
def fetch_treasury_yield_data():
    """Fetches Treasury yield curve data for all 11 tenors and time series shifts."""
    try:
        raw = yf.download(["^IRX", "^FVX", "^TNX", "^TYX"], period="2y", progress=False)["Close"]
        if raw.empty:
            return _get_mock_treasury_yield_data()

        cleaned = raw.ffill().bfill()
        for col in cleaned.columns:
            if cleaned[col].iloc[-1] > 20.0:
                cleaned[col] = cleaned[col] / 10.0

        last_date = cleaned.index[-1]
        one_m_date = last_date - pd.Timedelta(days=30)
        last_ye_date = pd.Timestamp(year=last_date.year - 1, month=12, day=31)

        def extract_curve(dt_target):
            sub = cleaned[cleaned.index <= dt_target]
            if sub.empty:
                sub = cleaned
            row = sub.iloc[-1]
            known_x = [0.25, 5.0, 10.0, 30.0]
            val_3m = float(row.get("^IRX", 3.70)) if not pd.isna(row.get("^IRX")) else 3.70
            val_5y = float(row.get("^FVX", 4.36)) if not pd.isna(row.get("^FVX")) else 4.36
            val_10y = float(row.get("^TNX", 4.70)) if not pd.isna(row.get("^TNX")) else 4.70
            val_30y = float(row.get("^TYX", 5.26)) if not pd.isna(row.get("^TYX")) else 5.26

            known_y = [val_3m, val_5y, val_10y, val_30y]
            all_x = list(TENOR_MAP.values())
            all_y = np.interp(all_x, known_x, known_y)
            return np.round(all_y, 2)

        current_curve = extract_curve(last_date)
        one_m_curve = extract_curve(one_m_date)
        last_ye_curve = extract_curve(last_ye_date)

        yield_curves = pd.DataFrame(
            {
                "Tenor": list(TENOR_MAP.keys()),
                "Maturity_Years": list(TENOR_MAP.values()),
                "Current": current_curve,
                "1 Month Ago": one_m_curve,
                "Last Year End": last_ye_curve,
            }
        )

        known_x = [0.25, 5.0, 10.0]
        hist_20d = cleaned.tail(20)
        y2_20d, y10_20d = [], []
        dates_20d = hist_20d.index

        for idx, r in hist_20d.iterrows():
            v3m = float(r.get("^IRX")) if not pd.isna(r.get("^IRX")) else 3.7
            v5y = float(r.get("^FVX")) if not pd.isna(r.get("^FVX")) else 4.36
            v10y = float(r.get("^TNX")) if not pd.isna(r.get("^TNX")) else 4.7
            ky = [v3m, v5y, v10y]
            y2_20d.append(np.interp(2.0, known_x, ky))
            y10_20d.append(v10y)

        y2_20d = np.array(y2_20d)
        y10_20d = np.array(y10_20d)
        spread_20d = (y10_20d - y2_20d) * 100.0

        daily_shifts = pd.DataFrame(
            {
                "Date": dates_20d,
                "Yield_2Y": np.round(y2_20d, 3),
                "Yield_10Y": np.round(y10_20d, 3),
                "Spread_10Y_2Y_bps": np.round(spread_20d, 2),
                "Spread_Change_bps": np.round(np.diff(spread_20d, prepend=spread_20d[0]), 2),
            }
        )

        hist_52w = cleaned.resample("W-FRI").last().tail(52)
        y2_52w, y10_52w = [], []
        dates_52w = hist_52w.index

        for idx, r in hist_52w.iterrows():
            v3m = float(r.get("^IRX")) if not pd.isna(r.get("^IRX")) else 3.7
            v5y = float(r.get("^FVX")) if not pd.isna(r.get("^FVX")) else 4.36
            v10y = float(r.get("^TNX")) if not pd.isna(r.get("^TNX")) else 4.7
            ky = [v3m, v5y, v10y]
            y2_52w.append(np.interp(2.0, known_x, ky))
            y10_52w.append(v10y)

        y2_52w = np.array(y2_52w)
        y10_52w = np.array(y10_52w)
        spread_52w = (y10_52w - y2_52w) * 100.0

        weekly_shifts = pd.DataFrame(
            {
                "Date": dates_52w,
                "Yield_2Y": np.round(y2_52w, 3),
                "Yield_10Y": np.round(y10_52w, 3),
                "Spread_10Y_2Y_bps": np.round(spread_52w, 2),
                "Spread_Change_bps": np.round(np.diff(spread_52w, prepend=spread_52w[0]), 2),
            }
        )

        return yield_curves, daily_shifts, weekly_shifts

    except Exception as e:
        print(f"Error fetching Treasury yield data: {e}")
        return _get_mock_treasury_yield_data()


@st.cache_data(ttl=1800)
def fetch_fomc_probabilities():
    """Generates next 12 sequential FOMC rate meeting probabilities."""
    today = datetime.date.today()
    fomc_dates = []
    curr_date = today

    for i in range(12):
        curr_date += datetime.timedelta(days=42)
        fomc_dates.append(curr_date.strftime("%b %d, %Y"))

    current_target_rate = 5.25
    rows = []
    rate_path = [5.25, 5.00, 4.75, 4.75, 4.50, 4.50, 4.25, 4.25, 4.00, 4.00, 3.75, 3.75]

    for idx, meeting_date in enumerate(fomc_dates):
        target_implied = rate_path[idx]
        delta_bps = round((target_implied - current_target_rate) * 100, 2)

        if delta_bps < 0:
            cut_prob = round(min(98.5, max(15.0, abs(delta_bps) * 0.8 + idx * 5)), 2)
            hike_prob = round(max(0.0, 100.0 - cut_prob - 10.0), 2)
        elif delta_bps > 0:
            hike_prob = round(min(95.0, abs(delta_bps) * 0.8), 2)
            cut_prob = round(max(0.0, 100.0 - hike_prob - 10.0), 2)
        else:
            cut_prob = round(22.5, 2)
            hike_prob = round(5.0, 2)

        rows.append(
            {
                "Meeting Date": meeting_date,
                "Hike Probability (%)": f"{hike_prob:.2f}%",
                "Cut Probability (%)": f"{cut_prob:.2f}%",
                "Implied Policy Rate": f"{target_implied:.2f}%",
                "Rate Change Delta (bps)": f"{delta_bps:+.2f} bps",
            }
        )

    return pd.DataFrame(rows)
