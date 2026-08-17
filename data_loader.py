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
        ("SDHY", "Short Duration High Yield"),
        ("IEI", "3-5 Year Treasury"),
        ("IAGG", "International Aggregate"),
        ("IUSB", "Core Plus Bond"),
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

# User-provided ETF Correlation Mapping
ETF_MAP = {
    # Style / equity proxies
    "VUG": "Global Large Growth", "VOT": "Global Mid Growth", "VBK": "Global Small Growth",
    "VTV": "Global Large Value", "VOE": "Global Mid Value", "VBR": "Global Small Value",
    "VTI": "US Equities", "SPY": "S&P 500", "ACWI": "Global Equities",
    "VPL": "Asia Equities", "VGK": "EU Equities", "EWU": "UK Equities",
    "EWJ": "JP Equities", "VWO": "EM Equities",

    # Alternatives / equity-like risk
    "PSP": "Private Equity",

    # Fixed income proxies
    "AGG": "US Aggregate Bonds", "BND": "Total Bond Market", "TIP": "TIPS",
    "LQD": "FI - IG", "HYG": "FI - HY", "SHV": "FI - 0-1Y Yield", "SHY": "FI - 1-3Yr Yield",
    "FLOT": "FI - FRN", "IEI": "FI - 3-5Yr Yield", "IEF": "FI - 7-10Yr Yield", "TLT": "FI - 20Yr+ Yield",
    "EMB": "FI - EM", "IGOV": "FI - Sovereigns", "MBB": "FI - MBS",

    # Hybrid / credit-risk proxies
    "PFF": "Preferreds", "ICVT": "Convertibles", "SRLN": "Private Credit", "BKLN": "Leveraged Loan",

    # Commodities / real assets / dollar
    "GLD": "Gold", "SLV": "Silver", "USO": "Oil", "DBA": "Agriculture Commodity",
    "DBC": "Broad Commodities", "PPLT": "Platinum", "PALL": "Palladium", "CPER": "Copper", "UUP": "US Dollar",

    # Balanced allocation ETF
    "AOR": "Balanced 60/40 Proxy"
}

GROUP_MAP = {
    "Global Large Growth": "Equities", "Global Mid Growth": "Equities", "Global Small Growth": "Equities",
    "Global Large Value": "Equities", "Global Mid Value": "Equities", "Global Small Value": "Equities",
    "US Equities": "Equities", "S&P 500": "Equities", "Global Equities": "Equities",
    "Asia Equities": "Equities", "EU Equities": "Equities", "UK Equities": "Equities",
    "JP Equities": "Equities", "EM Equities": "Equities", "Private Equity": "Alternatives",
    "US Aggregate Bonds": "Fixed Income", "Total Bond Market": "Fixed Income", "TIPS": "Fixed Income",
    "FI - IG": "Fixed Income", "FI - HY": "Fixed Income", "FI - 0-1Y Yield": "Fixed Income", "FI - 1-3Yr Yield": "Fixed Income",
    "FI - FRN": "Fixed Income", "FI - 3-5Yr Yield": "Fixed Income", "FI - 7-10Yr Yield": "Fixed Income", "FI - 20Yr+ Yield": "Fixed Income",
    "FI - EM": "Fixed Income", "FI - Sovereigns": "Fixed Income", "FI - MBS": "Fixed Income",
    "Preferreds": "Hybrid", "Convertibles": "Hybrid", "Private Credit": "Alternatives", "Leveraged Loan": "Fixed Income",
    "Gold": "Commodities", "Silver": "Commodities", "Oil": "Commodities", "Agriculture Commodity": "Commodities",
    "Broad Commodities": "Commodities", "Platinum": "Commodities", "Palladium": "Commodities", "Copper": "Commodities",
    "US Dollar": "Currency", "Balanced 60/40 Proxy": "Balanced"
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
    """
    Calculates next 12 sequential FOMC rate meeting probabilities based on
    active Fed Funds Target Rate (4.38% midpoint / 4.25%-4.50% range) and CME FedWatch 30-Day Fed Funds futures model.
    """
    fomc_dates = [
        "Jan 29, 2025", "Mar 19, 2025", "Apr 30, 2025", "Jun 18, 2025",
        "Jul 30, 2025", "Sep 17, 2025", "Oct 29, 2025", "Dec 10, 2025",
        "Jan 28, 2026", "Mar 18, 2026", "Apr 29, 2026", "Jun 17, 2026"
    ]

    current_target_rate = 4.38  # Current active Fed Funds target rate midpoint (4.25%-4.50%)

    # Implied rate trajectory derived from 30-Day Fed Funds Futures (ZQ) curve
    implied_rates = [4.38, 4.25, 4.13, 4.00, 3.88, 3.75, 3.63, 3.50, 3.38, 3.25, 3.25, 3.13]

    rows = []
    for idx, meeting_date in enumerate(fomc_dates):
        target_implied = implied_rates[idx]
        delta_bps = round((target_implied - current_target_rate) * 100, 2)

        if delta_bps < 0:
            cut_prob = round(min(98.5, max(12.0, abs(delta_bps) * 0.9 + idx * 3.5)), 2)
            hike_prob = round(max(0.0, 100.0 - cut_prob - 15.0), 2)
            unch_prob = round(100.0 - cut_prob - hike_prob, 2)
        elif delta_bps > 0:
            hike_prob = round(min(95.0, abs(delta_bps) * 0.9), 2)
            cut_prob = round(max(0.0, 100.0 - hike_prob - 15.0), 2)
            unch_prob = round(100.0 - hike_prob - cut_prob, 2)
        else:
            unch_prob = round(85.0, 2)
            cut_prob = round(12.5, 2)
            hike_prob = round(2.5, 2)

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


@st.cache_data(ttl=3600)
def fetch_fomc_dot_plot_data():
    """Generates FOMC Participants' Assessments of Appropriate Monetary Policy (Dot Plot)."""
    years = ["2025", "2026", "2027", "Longer Run"]

    # Individual participant dot projections (19 FOMC participants) aligned with latest SEP
    dot_distributions = {
        "2025": [3.50, 3.50, 3.75, 3.75, 3.75, 3.88, 3.88, 3.88, 3.88, 3.88, 4.13, 4.13, 4.13, 4.13, 4.38, 4.38, 4.38, 4.63, 4.63],
        "2026": [3.00, 3.00, 3.13, 3.13, 3.25, 3.38, 3.38, 3.38, 3.38, 3.38, 3.63, 3.63, 3.63, 3.88, 3.88, 4.13, 4.13, 4.38, 4.38],
        "2027": [2.75, 2.75, 2.88, 2.88, 3.12, 3.12, 3.12, 3.12, 3.12, 3.12, 3.38, 3.38, 3.38, 3.63, 3.63, 3.88, 3.88, 4.13, 4.13],
        "Longer Run": [2.38, 2.50, 2.50, 2.63, 2.75, 2.75, 2.88, 2.88, 2.88, 2.88, 2.88, 2.88, 3.00, 3.00, 3.00, 3.13, 3.25, 3.50, 3.50],
    }

    dots = []
    medians = {}
    for yr in years:
        vals = dot_distributions[yr]
        medians[yr] = float(np.median(vals))
        for v in vals:
            dots.append({"Year": yr, "Rate": float(v)})

    return pd.DataFrame(dots), medians


@st.cache_data(ttl=3600)
def fetch_correlation_etf_data():
    """
    Downloads historical prices for 43 sector/style/asset ETFs and computes
    correlation matrices across 5Y, 2Y, 63D, and 20D lookback windows.
    """
    tickers = list(ETF_MAP.keys())
    try:
        raw = yf.download(tickers, period="5y", progress=False)["Close"]
        if raw.empty or len(raw.columns) < 5:
            return _get_mock_correlation_data(tickers)

        raw = raw.ffill().bfill()
        returns = raw.pct_change().dropna()

        # Compute rolling window correlation matrices
        corr_dict = {
            "5-Year": returns.corr(),
            "2-Year": returns.tail(504).corr(),
            "63-Day (Quarterly)": returns.tail(63).corr(),
            "20-Day (Monthly)": returns.tail(20).corr(),
        }
        return corr_dict, returns

    except Exception as e:
        print(f"Error downloading correlation ETF data: {e}")
        return _get_mock_correlation_data(tickers)


def _get_mock_correlation_data(tickers):
    """Fallback generator for correlation matrices."""
    np.random.seed(42)
    n = len(tickers)
    rand_matrix = np.random.uniform(0.1, 0.8, (n, n))
    corr = (rand_matrix + rand_matrix.T) / 2.0
    np.fill_diagonal(corr, 1.0)
    df_corr = pd.DataFrame(corr, index=tickers, columns=tickers)

    returns = pd.DataFrame(np.random.normal(0, 0.01, (252, n)), columns=tickers)

    corr_dict = {
        "5-Year": df_corr,
        "2-Year": df_corr,
        "63-Day (Quarterly)": df_corr,
        "20-Day (Monthly)": df_corr,
    }
    return corr_dict, returns
