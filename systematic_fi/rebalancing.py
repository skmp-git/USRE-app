"""
Rebalancing & Turnover Engine Module.

1. Transfer Coefficient (TC) Distance Metric:
   Measures risk-weighted separation distance between current holdings and target weights:
   TC_distance = sqrt( (w_current - w_target)^T * Sigma * (w_current - w_target) )

2. Automated Rebalancing Triggers:
   Evaluates rebalancing necessity based on:
   - Uninvested cash accumulation exceeding threshold (e.g. coupons / maturities).
   - TC separation distance breaching specified threshold.
"""

from typing import Dict, Optional, Tuple, Union
import numpy as np
import pandas as pd


class RebalanceEngine:
    """
    Engine for measuring portfolio drift and determining automated rebalancing triggers.
    """

    def __init__(
        self,
        tc_threshold: float = 0.05,
        cash_threshold: float = 0.05
    ):
        """
        :param tc_threshold: Transfer Coefficient risk-weighted distance threshold for rebalance trigger.
        :param cash_threshold: Cash percentage threshold of total portfolio value for rebalance trigger.
        """
        self.tc_threshold = tc_threshold
        self.cash_threshold = cash_threshold

    @staticmethod
    def calculate_transfer_coefficient_distance(
        current_weights: Union[pd.Series, Dict[str, float]],
        target_weights: Union[pd.Series, Dict[str, float]],
        covariance_matrix: Optional[Union[pd.DataFrame, np.ndarray]] = None
    ) -> float:
        """
        Calculates the Transfer Coefficient (TC) distance metric measuring risk-weighted separation
        between current holdings and target weights.

        TC_distance = sqrt( (w_curr - w_targ)^T * Sigma * (w_curr - w_targ) )
        If covariance_matrix is None, defaults to identity matrix (Euclidean norm of weight difference).
        """
        if isinstance(current_weights, dict):
            current_weights = pd.Series(current_weights)
        if isinstance(target_weights, dict):
            target_weights = pd.Series(target_weights)

        # Align assets
        all_assets = sorted(list(set(current_weights.index).union(set(target_weights.index))))
        w_curr = current_weights.reindex(all_assets, fill_value=0.0).values
        w_targ = target_weights.reindex(all_assets, fill_value=0.0).values

        diff = w_curr - w_targ

        if covariance_matrix is None:
            # Identity matrix (unweighted L2 distance)
            distance = np.sqrt(np.sum(diff ** 2))
        else:
            if isinstance(covariance_matrix, pd.DataFrame):
                cov = covariance_matrix.reindex(index=all_assets, columns=all_assets, fill_value=0.0).values
            else:
                cov = covariance_matrix

            variance = np.dot(diff.T, np.dot(cov, diff))
            distance = np.sqrt(max(0.0, variance))

        return float(distance)

    def evaluate_rebalance_trigger(
        self,
        current_weights: Union[pd.Series, Dict[str, float]],
        target_weights: Union[pd.Series, Dict[str, float]],
        uninvested_cash: float,
        total_portfolio_value: float,
        covariance_matrix: Optional[Union[pd.DataFrame, np.ndarray]] = None
    ) -> Dict[str, Union[bool, float, str]]:
        """
        Evaluates portfolio status and determines whether rebalancing is triggered.

        Triggers:
        1. Cash accumulation fraction (uninvested_cash / total_portfolio_value) >= cash_threshold.
        2. TC distance metric >= tc_threshold.
        """
        tc_dist = self.calculate_transfer_coefficient_distance(
            current_weights, target_weights, covariance_matrix
        )

        cash_ratio = uninvested_cash / max(total_portfolio_value, 1e-8)

        cash_trigger = cash_ratio >= self.cash_threshold
        tc_trigger = tc_dist >= self.tc_threshold
        should_rebalance = cash_trigger or tc_trigger

        reasons = []
        if cash_trigger:
            reasons.append(f"Cash ratio ({cash_ratio:.2%}) >= threshold ({self.cash_threshold:.2%})")
        if tc_trigger:
            reasons.append(f"TC drift distance ({tc_dist:.4f}) >= threshold ({self.tc_threshold:.4f})")

        reason_str = "; ".join(reasons) if reasons else "No rebalance required (drift within limits)"

        return {
            "should_rebalance": should_rebalance,
            "tc_distance": tc_dist,
            "cash_ratio": cash_ratio,
            "cash_trigger": cash_trigger,
            "tc_trigger": tc_trigger,
            "reason": reason_str,
        }

    @staticmethod
    def generate_rebalance_trades(
        current_weights: Dict[str, float],
        target_weights: Dict[str, float],
        total_portfolio_value: float
    ) -> pd.DataFrame:
        """
        Computes dollar trades required to rebalance from current weights to target weights.
        """
        all_assets = sorted(list(set(current_weights.keys()).union(set(target_weights.keys()))))
        trades = []

        for asset in all_assets:
            w_c = current_weights.get(asset, 0.0)
            w_t = target_weights.get(asset, 0.0)
            w_diff = w_t - w_c
            dollar_trade = w_diff * total_portfolio_value
            trades.append({
                "asset": asset,
                "current_weight": w_c,
                "target_weight": w_t,
                "weight_change": w_diff,
                "dollar_trade": dollar_trade,
                "action": "BUY" if dollar_trade > 0 else ("SELL" if dollar_trade < 0 else "HOLD")
            })

        return pd.DataFrame(trades).set_index("asset")
