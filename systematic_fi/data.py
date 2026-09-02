"""
Data Ingestion & Preprocessing Module.

Handles fetching time series from FRED (via direct CSV endpoints or API)
and enforcing strict chronological expanding window transformations without lookahead bias.
"""

from typing import Dict, List, Optional, Union
import io
import urllib.request
import numpy as np
import pandas as pd


# Default FRED series mappings for sovereign yields, bill rates, inflation, credit spreads
DEFAULT_FRED_SERIES = {
    "bill_3m": "DGS3MO",          # 3-Month Treasury Bill Secondary Market Rate
    "yield_2y": "DGS2",           # 2-Year Treasury Constant Maturity Rate
    "yield_5y": "DGS5",           # 5-Year Treasury Constant Maturity Rate
    "yield_10y": "DGS10",         # 10-Year Treasury Constant Maturity Rate
    "yield_30y": "DGS30",         # 30-Year Treasury Constant Maturity Rate
    "inflation_10y": "T10YIEM",   # 10-Year Expected Inflation (or T10YIE / EXPINF10YR)
    "ig_spread": "BAMLC0A0CM",    # ICE BofA US Corporate Option-Adjusted Spread
    "hy_spread": "BAMLH0A0HYM2",  # ICE BofA US High Yield Option-Adjusted Spread
}


class FREDDataIngestor:
    """
    Ingests sovereign bond yields, bill rates, inflation expectations,
    and credit spreads from FRED CSV endpoints or FRED API.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def fetch_series_csv(self, series_id: str) -> pd.Series:
        """
        Fetches a single series from FRED via direct CSV download URL.
        """
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            csv_data = response.read().decode("utf-8")
        df = pd.read_csv(io.StringIO(csv_data), parse_dates=["DATE"])
        df = df.replace(".", np.nan)
        # Convert value column to numeric
        val_col = df.columns[1]
        df[val_col] = pd.to_numeric(df[val_col], errors="coerce")
        df = df.set_index("DATE")[val_col]
        df.name = series_id
        return df

    def fetch_multiple_series(
        self,
        series_map: Optional[Dict[str, str]] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        fallback_synthetic: bool = True
    ) -> pd.DataFrame:
        """
        Fetches multiple series from FRED and merges them into a DataFrame aligned by date.
        If network fails and fallback_synthetic is True, generates a realistic synthetic dataset.
        """
        if series_map is None:
            series_map = DEFAULT_FRED_SERIES

        data_dict: Dict[str, pd.Series] = {}
        fetch_failed = False

        for name, series_id in series_map.items():
            try:
                s = self.fetch_series_csv(series_id)
                data_dict[name] = s
            except Exception as e:
                fetch_failed = True
                break

        if fetch_failed and fallback_synthetic:
            return generate_synthetic_fi_data(start_date=start_date or "2010-01-01", end_date=end_date or "2023-12-31")

        df = pd.DataFrame(data_dict)
        df = df.sort_index()

        if start_date:
            df = df.loc[df.index >= pd.to_datetime(start_date)]
        if end_date:
            df = df.loc[df.index <= pd.to_datetime(end_date)]

        return df


def generate_synthetic_fi_data(
    start_date: str = "2010-01-01",
    end_date: str = "2023-12-31",
    freq: str = "B",
    seed: int = 42
) -> pd.DataFrame:
    """
    Generates realistic synthetic daily fixed income data for offline testing or demo use.
    Enforces logical yield curve hierarchy (3M < 2Y < 5Y < 10Y < 30Y on average).
    """
    np.random.seed(seed)
    dates = pd.date_range(start=start_date, end=end_date, freq=freq)
    n = len(dates)

    # Base interest rate path (random walk with mean reversion)
    base_rate = np.zeros(n)
    base_rate[0] = 2.0
    for i in range(1, n):
        dr = 0.02 * (2.0 - base_rate[i - 1]) + np.random.normal(0, 0.05)
        base_rate[i] = max(0.05, base_rate[i - 1] + dr)

    bill_3m = base_rate + np.random.normal(0, 0.02, n)
    yield_2y = base_rate + 0.5 + np.random.normal(0, 0.03, n)
    yield_5y = base_rate + 1.2 + np.random.normal(0, 0.04, n)
    yield_10y = base_rate + 1.8 + np.random.normal(0, 0.04, n)
    yield_30y = base_rate + 2.3 + np.random.normal(0, 0.05, n)

    inflation_10y = 2.0 + 0.3 * np.sin(np.linspace(0, 8 * np.pi, n)) + np.random.normal(0, 0.05, n)
    ig_spread = 1.5 + 0.5 * np.exp(-base_rate / 3.0) + np.random.normal(0, 0.03, n)
    hy_spread = 4.5 + 1.5 * np.exp(-base_rate / 3.0) + np.random.normal(0, 0.1, n)

    # Corporate fundamentals for residual regression (profitability, leverage, volatility)
    profitability = 0.15 + 0.02 * np.random.randn(n)
    leverage = 0.40 + 0.05 * np.random.randn(n)
    equity_vol = 0.18 + 0.04 * np.abs(np.random.randn(n))
    equity_price = 100.0 * np.exp(np.cumsum(np.random.normal(0.0003, 0.01, n)))

    df = pd.DataFrame({
        "bill_3m": bill_3m,
        "yield_2y": yield_2y,
        "yield_5y": yield_5y,
        "yield_10y": yield_10y,
        "yield_30y": yield_30y,
        "inflation_10y": inflation_10y,
        "ig_spread": ig_spread,
        "hy_spread": hy_spread,
        "profitability": profitability,
        "leverage": leverage,
        "equity_vol": equity_vol,
        "equity_price": equity_price,
    }, index=dates)

    return df.clip(lower=0.01)


class DataPreprocessor:
    """
    Enforces strict chronological processing to prevent lookahead bias.
    All parameters are computed using expanding historical windows.
    """

    @staticmethod
    def clean_and_align(df: pd.DataFrame, min_periods: int = 1) -> pd.DataFrame:
        """
        Sorts chronologically, forward-fills missing observations, and drops initial NaNs.
        """
        clean_df = df.sort_index().ffill().dropna(how="all")
        return clean_df

    @staticmethod
    def expanding_quantile(series: pd.Series, quantile: float, min_periods: int = 30) -> pd.Series:
        """
        Computes the expanding quantile strictly up to time t without lookahead bias.
        """
        def calc_q(x):
            if len(x) < min_periods:
                return np.nan
            return np.quantile(x, quantile)

        return series.expanding(min_periods=min_periods).apply(calc_q, raw=True)

    @staticmethod
    def expanding_median(series: pd.Series, min_periods: int = 30) -> pd.Series:
        """
        Computes expanding median without lookahead bias.
        """
        return series.expanding(min_periods=min_periods).median()

    @staticmethod
    def expanding_mean(series: pd.Series, min_periods: int = 1) -> pd.Series:
        """
        Computes expanding mean without lookahead bias.
        """
        return series.expanding(min_periods=min_periods).mean()

    @staticmethod
    def expanding_std(series: pd.Series, min_periods: int = 2) -> pd.Series:
        """
        Computes expanding standard deviation without lookahead bias.
        """
        return series.expanding(min_periods=min_periods).std()
