"""
Four-Step Signal Transformation Pipeline Module.

Applies standardized normalization to raw quantitative signals using expanding windows:
1. Step 1 (Extreme Value Treatment): Cap and floor each signal based on expanding 95th and 5th percentile values.
2. Step 2 (Benchmarking): Subtract the expanding median value from the current signal realization.
3. Step 3 (Volatility Scaling): Divide the benchmark-adjusted value by an expanding non-parametric volatility measure
   defined as the spread between the 95th and 5th percentiles.
4. Step 4 (Timing Curves): Convert the resulting Z-scored signal via a linear capped and floored transformation
   restricted between 50% and 150% invested exposure.
"""

from typing import Optional, Union, Dict
import numpy as np
import pandas as pd


class SignalTransformer:
    """
    Implements expanding-window four-step signal normalization pipeline to prevent lookahead bias.
    """

    def __init__(
        self,
        lower_quantile: float = 0.05,
        upper_quantile: float = 0.95,
        min_periods: int = 30,
        min_exposure: float = 0.50,
        max_exposure: float = 1.50,
        sensitivity: float = 0.50
    ):
        self.lower_q = lower_quantile
        self.upper_q = upper_quantile
        self.min_periods = min_periods
        self.min_exposure = min_exposure
        self.max_exposure = max_exposure
        self.sensitivity = sensitivity

    def step1_extreme_value_treatment(self, signal: pd.Series) -> pd.Series:
        """
        Step 1: Cap and floor signal based on expanding 95th and 5th percentiles.
        """
        def clip_expanding(sub_array):
            if len(sub_array) < self.min_periods:
                return sub_array[-1]
            p_low = np.quantile(sub_array, self.lower_q)
            p_high = np.quantile(sub_array, self.upper_q)
            return np.clip(sub_array[-1], p_low, p_high)

        capped = signal.expanding(min_periods=self.min_periods).apply(clip_expanding, raw=True)
        # Fill initial warmup periods with unclipped raw signal values
        capped = capped.fillna(signal)
        capped.name = f"{signal.name}_step1_capped"
        return capped

    def step2_benchmarking(self, step1_signal: pd.Series) -> pd.Series:
        """
        Step 2: Subtract expanding median value from current signal realization.
        """
        exp_median = step1_signal.expanding(min_periods=self.min_periods).median()
        # For warmup periods where median is NaN, fallback to cumulative mean
        exp_median = exp_median.fillna(step1_signal.expanding(min_periods=1).mean())
        benchmarked = step1_signal - exp_median
        benchmarked.name = f"{step1_signal.name}_step2_benchmarked"
        return benchmarked

    def step3_volatility_scaling(self, step2_signal: pd.Series, raw_signal: pd.Series) -> pd.Series:
        """
        Step 3: Divide benchmark-adjusted value by non-parametric expanding volatility measure
        defined as spread between 95th and 5th percentiles of raw signal.
        """
        def calc_spread(sub_array):
            if len(sub_array) < self.min_periods:
                return np.nan
            return np.quantile(sub_array, self.upper_q) - np.quantile(sub_array, self.lower_q)

        vol_spread = raw_signal.expanding(min_periods=self.min_periods).apply(calc_spread, raw=True)

        # Replace 0 or NaNs with standard deviation or non-zero fallback
        std_fallback = raw_signal.expanding(min_periods=2).std().replace(0, np.nan)
        vol_spread = vol_spread.fillna(std_fallback).fillna(1.0)
        vol_spread = vol_spread.apply(lambda x: max(x, 1e-4))

        z_score = step2_signal / vol_spread
        z_score.name = f"{raw_signal.name}_step3_zscore"
        return z_score

    def step4_timing_curves(self, step3_zscore: pd.Series) -> pd.Series:
        """
        Step 4: Convert Z-scored signal via linear capped and floored transformation
        restricted between min_exposure (50%) and max_exposure (150%).

        Exposure = 1.0 + sensitivity * Z_score
        Capped at [min_exposure, max_exposure].
        """
        target_exposure = 1.0 + self.sensitivity * step3_zscore
        final_exposure = target_exposure.clip(lower=self.min_exposure, upper=self.max_exposure)
        final_exposure.name = f"{step3_zscore.name}_step4_exposure"
        return final_exposure

    def transform_pipeline(self, raw_signal: pd.Series) -> pd.DataFrame:
        """
        Executes complete 4-step transformation pipeline, returning DataFrame with all intermediate steps.
        """
        s1 = self.step1_extreme_value_treatment(raw_signal)
        s2 = self.step2_benchmarking(s1)
        s3 = self.step3_volatility_scaling(s2, raw_signal)
        s4 = self.step4_timing_curves(s3)

        df = pd.DataFrame({
            "raw_signal": raw_signal,
            "step1_capped": s1,
            "step2_benchmarked": s2,
            "step3_zscore": s3,
            "step4_exposure": s4
        })
        return df
