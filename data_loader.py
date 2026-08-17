import calendar
import datetime
import logging
import math
from collections import defaultdict
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pandas_datareader.data as web
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


def _build_futures_tickers(ticker_base="ZQ", exchange="CBT", horizon=24):
    """Generates CME/CBOT 30-Day Federal Funds Futures ticker strings and corresponding labels."""
    month_codes = {1: "F", 2: "G", 3: "H", 4: "J", 5: "K", 6: "M", 7: "N", 8: "Q", 9: "U", 10: "V", 11: "X", 12: "Z"}
    start_date = pd.Timestamp.now().to_period("M").to_timestamp()
    date_series = pd.date_range(start=start_date, periods=horizon, freq="MS")
    tickers = [f"{ticker_base}{month_codes[d.month]}{str(d.year)[-2:]}.{exchange}" for d in date_series]
    labels = [f"{d.strftime('%b')} {d.year}" for d in date_series]
    return tickers, labels


def fetch_ff_futures_data():
    """Fetches Fed Funds Futures (ZQ) and EFFR (DFF from FRED)."""
    yf_logger = logging.getLogger("yfinance")
    original_level = yf_logger.level
    yf_logger.setLevel(logging.CRITICAL)

    tickers, labels = _build_futures_tickers("ZQ", "CBT", 24)

    try:
        raw_closes = yf.download(tickers, period="5d", auto_adjust=False, progress=False)["Close"]
    except Exception:
        try:
            raw_closes = yf.download(tickers, period="5d", auto_adjust=False, progress=False)
            if isinstance(raw_closes, pd.DataFrame) and "Close" in raw_closes.columns:
                raw_closes = raw_closes["Close"]
        except Exception:
            raw_closes = pd.DataFrame()

    yf_logger.setLevel(original_level)

    futures_list = []
    if isinstance(raw_closes, pd.DataFrame) and not raw_closes.empty:
        for ticker, label in zip(tickers, labels):
            if ticker in raw_closes.columns:
                series = raw_closes[ticker].dropna()
                if not series.empty:
                    price = series.iloc[-1]
                    futures_list.append(
                        {
                            "contract": label,
                            "ticker": ticker,
                            "price": price,
                            "implied_rate": 100 - price,
                        }
                    )
    elif isinstance(raw_closes, pd.Series) and not raw_closes.empty:
        series = raw_closes.dropna()
        if not series.empty and len(tickers) > 0:
            price = series.iloc[-1]
            futures_list.append(
                {
                    "contract": labels[0],
                    "ticker": tickers[0],
                    "price": price,
                    "implied_rate": 100 - price,
                }
            )

    ff_df = pd.DataFrame(futures_list)

    try:
        effr_series = web.DataReader("DFF", "fred", start=datetime.datetime.now() - timedelta(days=10))
        effr_val = float(effr_series.iloc[-1].iloc[0]) if isinstance(effr_series.iloc[-1], pd.Series) else float(effr_series.iloc[-1])
    except Exception:
        effr_val = 4.33

    return ff_df, effr_val


def get_dynamic_fomc_dates(num_upcoming=12):
    """Calculates upcoming FOMC meeting dates algorithmically."""
    today = date.today()
    future_dates = []
    standard_months = [1, 3, 5, 6, 7, 9, 11, 12]
    start_year = today.year

    for year in range(start_year, start_year + 3):
        for month in standard_months:
            num_days = calendar.monthrange(year, month)[1]
            wednesdays = []
            for day in range(1, num_days + 1):
                d = date(year, month, day)
                if d.weekday() == 2:
                    wednesdays.append(d)

            if not wednesdays:
                continue

            if month in [3, 5, 11] and len(wednesdays) >= 4:
                fomc_day = wednesdays[-2]
            else:
                fomc_day = wednesdays[-1]

            if fomc_day > today:
                future_dates.append(fomc_day)

    future_dates = sorted(list(set(future_dates)))
    return future_dates[:num_upcoming]


def compute_fedwatch(ff_df, current_effr):
    """Calculates CME FedWatch FOMC meeting probabilities from 30-Day Fed Funds futures."""
    if ff_df.empty or current_effr is None:
        return pd.DataFrame()

    contracts_dict = dict(zip(ff_df["contract"], ff_df["implied_rate"]))
    fomc_dates = get_dynamic_fomc_dates()

    EFFR_TARGET_SPREAD = 0.045
    month_key = lambda d: f"{d.strftime('%b')} {d.year}"

    results = []
    prev_post_rate = None
    prev_mtg = None
    cum_prob_dist = {0: 1.0}

    for mtg in fomc_dates:
        mk = month_key(mtg)
        if mk not in contracts_dict:
            prev_post_rate = None
            prev_mtg = mtg
            continue

        month_rate = contracts_dict[mk]
        days_in_month = calendar.monthrange(mtg.year, mtg.month)[1]
        d_b = mtg.day
        d_a = days_in_month - d_b

        prior_month = mtg.month - 1 if mtg.month > 1 else 12
        prior_year = mtg.year if mtg.month > 1 else mtg.year - 1
        prior_key = month_key(date(prior_year, prior_month, 1))

        use_chain = (
            prev_post_rate is not None
            and prev_mtg is not None
            and prev_mtg.year == mtg.year
            and prev_mtg.month == mtg.month
        )
        if use_chain:
            pre_rate = prev_post_rate
        elif prior_key in contracts_dict:
            pre_rate = contracts_dict[prior_key]
        elif prev_post_rate is not None:
            pre_rate = prev_post_rate
        else:
            pre_rate = current_effr

        next_month = mtg.month + 1 if mtg.month < 12 else 1
        next_year = mtg.year if mtg.month < 12 else mtg.year + 1
        next_key = month_key(date(next_year, next_month, 1))

        next_mtgs = [m for m in fomc_dates if m.year == next_year and m.month == next_month]
        has_next_month_mtg = len(next_mtgs) > 0
        next_mtg_day = next_mtgs[0].day if has_next_month_mtg else 31

        if not has_next_month_mtg and next_key in contracts_dict:
            post_rate = contracts_dict[next_key]
        elif d_a <= 10 and next_key in contracts_dict and next_mtg_day >= 15:
            post_rate = contracts_dict[next_key]
        elif d_a <= 10 and next_key not in contracts_dict:
            post_rate = month_rate
        else:
            if d_a == 0:
                d_a = 1
            post_rate = (month_rate * days_in_month - pre_rate * d_b) / d_a

        if post_rate < 0 or abs(post_rate - month_rate) > 0.75:
            post_rate = contracts_dict.get(next_key, month_rate)

        delta_marginal = (post_rate - pre_rate) * 100
        m_marginal = delta_marginal / 25.0

        lower_step = math.floor(m_marginal)
        upper_step = lower_step + 1
        prob_upper = m_marginal - lower_step
        prob_lower = 1.0 - prob_upper

        marginal_probs = {lower_step * 25: prob_lower, upper_step * 25: prob_upper}

        new_cum_dist = defaultdict(float)
        for cum_bp, cum_prob in cum_prob_dist.items():
            for marg_bp, marg_prob in marginal_probs.items():
                new_cum_dist[cum_bp + marg_bp] += cum_prob * marg_prob
        cum_prob_dist = dict(new_cum_dist)

        p_25 = sum(p for bp, p in marginal_probs.items() if abs(bp) == 25)
        p_50 = sum(p for bp, p in marginal_probs.items() if abs(bp) == 50)
        expected_cum_bp = sum(bp * p for bp, p in cum_prob_dist.items())
        cm = expected_cum_bp / 25.0

        if abs(cm) < 0.05:
            hike_cut_label = "—"
        elif cm < 0:
            hike_cut_label = f"{abs(cm):.1f} cuts"
        else:
            hike_cut_label = f"{cm:.1f} hikes"

        p0_val = (1.0 - (p_25 + p_50)) * 100

        results.append(
            {
                "Meeting Date": mtg.strftime("%b %d, %Y"),
                "Expected Hikes/Cuts": hike_cut_label,
                "Implied Policy Rate": f"{post_rate + EFFR_TARGET_SPREAD:.3f}%",
                "Rate Change Delta (bps)": f"{delta_marginal:+.1f} bps",
                "Prob Unchanged": f"{p0_val:.0f}%",
                "Prob 25bp Move": f"{p_25 * 100:.0f}%",
                "Prob 50bp Move": f"{p_50 * 100:.0f}%",
            }
        )
        prev_post_rate = post_rate
        prev_mtg = mtg

    return pd.DataFrame(results)


@st.cache_data(ttl=1800)
def fetch_fomc_probabilities():
    """
    Fetches Fed Funds Futures and EFFR, then computes dynamic CME FedWatch probabilities.
    Fallback to static table if futures strip is unavailable.
    """
    try:
        ff_df, current_effr = fetch_ff_futures_data()
        fedwatch_df = compute_fedwatch(ff_df, current_effr)
        if not fedwatch_df.empty:
            return fedwatch_df
    except Exception as e:
        print(f"Error computing dynamic FedWatch: {e}")

    # Fallback static table
    fomc_dates = [
        "Jan 29, 2025", "Mar 19, 2025", "Apr 30, 2025", "Jun 18, 2025",
        "Jul 30, 2025", "Sep 17, 2025", "Oct 29, 2025", "Dec 10, 2025",
        "Jan 28, 2026", "Mar 18, 2026", "Apr 29, 2026", "Jun 17, 2026"
    ]
    current_target_rate = 4.38
    implied_rates = [4.38, 4.25, 4.13, 4.00, 3.88, 3.75, 3.63, 3.50, 3.38, 3.25, 3.25, 3.13]
    rows = []
    for idx, meeting_date in enumerate(fomc_dates):
        target_implied = implied_rates[idx]
        delta_bps = round((target_implied - current_target_rate) * 100, 2)
        rows.append(
            {
                "Meeting Date": meeting_date,
                "Expected Hikes/Cuts": f"{abs(delta_bps/25):.1f} cuts" if delta_bps < 0 else "—",
                "Implied Policy Rate": f"{target_implied:.3f}%",
                "Rate Change Delta (bps)": f"{delta_bps:+.1f} bps",
                "Prob Unchanged": "15%",
                "Prob 25bp Move": "80%",
                "Prob 50bp Move": "5%",
            }
        )
    return pd.DataFrame(rows)


@st.cache_data(ttl=3600)
def fetch_fomc_dot_plot_data():
    """Generates FOMC Participants' Assessments of Appropriate Monetary Policy (Dot Plot)."""
    years = ["2025", "2026", "2027", "Longer Run"]

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
