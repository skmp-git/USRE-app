"""
Signal Generation Engine Module.

Implements Value, Momentum, and Carry signals for sovereign allocations and corporate credits:
1. Value Signals:
   - Real Bond Yields (nominal long-term government bond yield minus long-term inflation forecast).
   - Credit Spread Regression Residuals projected onto profitability, leverage, and equity volatility.
2. Momentum Signals:
   - 12-Month arithmetic average excess return over cash, skipping the most recent month's return (t-1).
   - Equity Momentum in Credit (EMC) composite using standardized Z-scores of 1M, 3M, 6M, and 12M rolling equity returns.
3. Carry Signals:
   - Rates Term Spread (long-term yield minus short-term bill rate).
   - Direct corporate credit spread.
4. Composite Regime Classification:
   - Combines normalized factor exposures across Value, Momentum, and Carry to output a overall portfolio signal:
     "AGGRESSIVE" (> 110% exposure), "NEUTRAL" (90% - 110% exposure), or "DEFENSIVE" (< 90% exposure).
"""

from typing import Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd
from scipy import stats


class SignalEngine:
    """
    Computes systematic quantitative signals (Value, Momentum, Carry) for fixed income assets.
    """

    @staticmethod
    def compute_real_bond_yield(
        nominal_yield: pd.Series,
        inflation_forecast: pd.Series
    ) -> pd.Series:
        """
        Calculates real bond yields: Nominal Long-Term Sovereign Yield - Long-Term Inflation Forecast.
        """
        aligned_df = pd.concat([nominal_yield, inflation_forecast], axis=1).ffill()
        real_yield = aligned_df.iloc[:, 0] - aligned_df.iloc[:, 1]
        real_yield.name = "real_bond_yield"
        return real_yield

    @staticmethod
    def compute_credit_spread_residual(
        credit_spread: pd.Series,
        profitability: pd.Series,
        leverage: pd.Series,
        volatility: pd.Series,
        min_periods: int = 60
    ) -> pd.Series:
        """
        Calculates credit spread regression residuals projected onto profitability, leverage, and volatility.
        Uses expanding window regression to ensure zero lookahead bias.

        Residual = Spread_t - Model_Spread_t
        A positive residual implies the spread is wider than fundamental drivers suggest (underpriced / high value).
        """
        df = pd.concat([credit_spread, profitability, leverage, volatility], axis=1).ffill().dropna()
        df.columns = ["spread", "profitability", "leverage", "volatility"]

        residuals = pd.Series(index=df.index, dtype=float)

        # Expanding regression to eliminate lookahead bias
        spread_vals = df["spread"].values
        X_vals = np.column_stack([
            np.ones(len(df)),
            df["profitability"].values,
            df["leverage"].values,
            df["volatility"].values
        ])

        for t in range(min_periods, len(df)):
            X_hist = X_vals[:t]
            y_hist = spread_vals[:t]

            try:
                # OLS solution beta = (X^T X)^-1 X^T y
                beta, _, _, _ = np.linalg.lstsq(X_hist, y_hist, rcond=None)
                pred_t = np.dot(X_vals[t], beta)
                residuals.iloc[t] = spread_vals[t] - pred_t
            except Exception:
                residuals.iloc[t] = np.nan

        residuals.name = "credit_spread_residual"
        return residuals

    @staticmethod
    def compute_rates_momentum(
        asset_prices_or_returns: pd.Series,
        cash_rate: Optional[pd.Series] = None,
        lookback_months: int = 12,
        skip_recent_months: int = 1
    ) -> pd.Series:
        """
        Calculates the 12-month arithmetic average of excess returns over cash,
        skipping the most recent month's return (t-1) to eliminate microstructure noise.
        """
        # Resample to monthly if higher frequency
        if isinstance(asset_prices_or_returns.index, pd.DatetimeIndex):
            m_data = asset_prices_or_returns.resample("ME").last().ffill()
            if cash_rate is not None:
                m_cash = cash_rate.resample("ME").last().ffill() / 1200.0  # Annual percentage to monthly fraction
            else:
                m_cash = pd.Series(0.0, index=m_data.index)
        else:
            m_data = asset_prices_or_returns
            m_cash = cash_rate if cash_rate is not None else pd.Series(0.0, index=m_data.index)

        # Monthly returns
        m_returns = m_data.pct_change()
        m_excess = m_returns - m_cash

        # Shift by skip_recent_months (e.g. 1 month) to drop t-1
        shifted_excess = m_excess.shift(skip_recent_months)

        # 12-month arithmetic average
        mom_signal = shifted_excess.rolling(window=lookback_months - skip_recent_months, min_periods=3).mean()

        # Re-index back to original daily series frequency if needed
        if isinstance(asset_prices_or_returns.index, pd.DatetimeIndex):
            mom_signal = mom_signal.reindex(asset_prices_or_returns.index, method="ffill")

        mom_signal.name = "rates_momentum"
        return mom_signal

    @staticmethod
    def compute_equity_momentum_in_credit(
        equity_prices: pd.Series,
        windows: Tuple[int, int, int, int] = (21, 63, 126, 252),
        min_periods: int = 60
    ) -> pd.Series:
        """
        Computes Equity Momentum in Credit (EMC) composite using standardized Z-scores
        of 1-month (~21d), 3-month (~63d), 6-month (~126d), and 12-month (~252d) rolling equity returns.

        R_{i, t}^m = (P_{i, t} - P_{i, t-m}) / P_{i, t-m}
        """
        z_scores = []

        for w in windows:
            # Rolling m-period return
            ret_m = equity_prices.pct_change(periods=w)

            # Expanding Z-score to prevent lookahead bias
            mean_exp = ret_m.expanding(min_periods=min_periods).mean()
            std_exp = ret_m.expanding(min_periods=min_periods).std()
            z_m = (ret_m - mean_exp) / std_exp.replace(0, np.nan)
            z_scores.append(z_m)

        emc_df = pd.concat(z_scores, axis=1)
        emc_composite = emc_df.mean(axis=1)
        emc_composite.name = "emc_composite"
        return emc_composite

    @staticmethod
    def compute_rates_carry(
        long_term_yield: pd.Series,
        short_term_bill_rate: pd.Series
    ) -> pd.Series:
        """
        Computes the Carry Signal for Rates: Term Spread = Long-Term Yield - Short-Term Bill Rate.
        """
        df = pd.concat([long_term_yield, short_term_bill_rate], axis=1).ffill()
        term_spread = df.iloc[:, 0] - df.iloc[:, 1]
        term_spread.name = "rates_term_spread"
        return term_spread

    @staticmethod
    def compute_credit_carry(
        credit_spread: pd.Series
    ) -> pd.Series:
        """
        Computes the Carry Signal for Corporate Credit: Direct Credit Spread.
        """
        carry = credit_spread.copy()
        carry.name = "credit_carry_spread"
        return carry

    @staticmethod
    def classify_overall_regime(
        composite_exposure: float,
        aggressive_threshold: float = 1.10,
        defensive_threshold: float = 0.90
    ) -> Dict[str, Union[str, float]]:
        """
        Classifies overall market stance into AGGRESSIVE, NEUTRAL, or DEFENSIVE
        based on composite exposure target.

        - Exposure >= 1.10 (110%): AGGRESSIVE (High yield/spread value, positive momentum, strong carry)
        - Exposure <= 0.90 (90%): DEFENSIVE (Low yield/spread value, negative momentum, flattened curve)
        - 0.90 < Exposure < 1.10: NEUTRAL (Balanced exposure)
        """
        if np.isnan(composite_exposure):
            regime = "NEUTRAL"
            description = "Insufficient historical data for regime classification."
            action = "Maintain baseline benchmark weights."
        elif composite_exposure >= aggressive_threshold:
            regime = "AGGRESSIVE"
            description = "High expected return environment (attractive value, positive momentum, steep carry curve)."
            action = "Overweight long-duration assets and credit risk spread assets (Target Exposure: ~110%-150%)."
        elif composite_exposure <= defensive_threshold:
            regime = "DEFENSIVE"
            description = "High macro risk or expensive valuations (flat/inverted yield curve, negative momentum)."
            action = "Underweight risk assets, reduce duration, accumulate short-term bills/cash (Target Exposure: ~50%-90%)."
        else:
            regime = "NEUTRAL"
            description = "Balanced macro conditions and neutral signal indicators."
            action = "Maintain neutral target asset weights (Target Exposure: ~90%-110%)."

        return {
            "regime": regime,
            "composite_exposure": composite_exposure,
            "description": description,
            "recommended_action": action
        }
