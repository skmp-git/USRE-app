"""
Yield Curve & Risk Management Module.

1. Partitions bond universes into three maturity buckets:
   - Short: 1 - 5 years
   - Medium: 5 - 10 years
   - Long: 10 - 30 years
2. Constructs duration-neutral Level, Slope, and Curvature (LSC) factors/assets,
   scaling leg weights to balance duration contributions across legs.
3. Calculates Key Rate Durations (KRD) across spot rate maturity nodes (e.g., 3M to 30Y)
   to quantify risk exposures to non-parallel yield curve shifts.
"""

from typing import Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


# Default maturity nodes for Key Rate Duration (KRD) calculations (in years)
DEFAULT_KRD_NODES = [0.25, 1.0, 2.0, 5.0, 7.0, 10.0, 20.0, 30.0]


class YieldCurveRiskManager:
    """
    Manages yield curve decomposition, duration-neutral factor construction, and Key Rate Duration (KRD) calculations.
    """

    @staticmethod
    def classify_maturity_bucket(maturity_years: float) -> str:
        """
        Classifies bond maturity into Short (1-5y), Medium (5-10y), or Long (10-30y).
        """
        if maturity_years < 5.0:
            return "Short"
        elif maturity_years <= 10.0:
            return "Medium"
        else:
            return "Long"

    @staticmethod
    def partition_bond_universe(bonds_df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
        """
        Partitions a DataFrame of bonds (with a 'maturity' column in years) into maturity buckets.
        """
        if "maturity" not in bonds_df.columns:
            raise ValueError("bonds_df must contain a 'maturity' column.")

        df = bonds_df.copy()
        df["bucket"] = df["maturity"].apply(YieldCurveRiskManager.classify_maturity_bucket)

        return {
            "Short": df[df["bucket"] == "Short"],
            "Medium": df[df["bucket"] == "Medium"],
            "Long": df[df["bucket"] == "Long"],
        }

    @staticmethod
    def construct_duration_neutral_lsc(
        short_dur: float,
        med_dur: float,
        long_dur: float
    ) -> Dict[str, Dict[str, float]]:
        """
        Constructs duration-neutral Level, Slope, and Curvature (LSC) asset weightings.

        - Level: Equal positive weight across Short, Medium, Long (scaled to unit duration exposure).
        - Slope: Short vs Long. Weight_short * Dur_short + Weight_long * Dur_long = 0.
        - Curvature: 2 * Medium vs (Short + Long).
          Weight_med * Dur_med + Weight_short * Dur_short + Weight_long * Dur_long = 0.
        """
        # Level factor: parallel shift (1/3 each, normalized by average duration)
        avg_dur = (short_dur + med_dur + long_dur) / 3.0
        w_level = {
            "Short": 1.0 / (3.0 * short_dur) if short_dur > 0 else 1/3,
            "Medium": 1.0 / (3.0 * med_dur) if med_dur > 0 else 1/3,
            "Long": 1.0 / (3.0 * long_dur) if long_dur > 0 else 1/3,
        }

        # Slope factor: Long duration leg - Short duration leg (duration-matched)
        # Weight_long * dur_long = 1.0, Weight_short * dur_short = -1.0
        w_slope = {
            "Short": -1.0 / short_dur if short_dur > 0 else -1.0,
            "Medium": 0.0,
            "Long": 1.0 / long_dur if long_dur > 0 else 1.0,
        }

        # Curvature factor: Medium leg vs (Short + Long legs)
        # 2 * (Med_weight * med_dur) = (Short_weight * short_dur) + (Long_weight * long_dur)
        # Target: Med duration contribution = +1.0, Short contribution = -0.5, Long contribution = -0.5
        w_curvature = {
            "Short": -0.5 / short_dur if short_dur > 0 else -0.5,
            "Medium": 1.0 / med_dur if med_dur > 0 else 1.0,
            "Long": -0.5 / long_dur if long_dur > 0 else -0.5,
        }

        return {
            "Level": w_level,
            "Slope": w_slope,
            "Curvature": w_curvature,
        }

    @staticmethod
    def compute_key_rate_durations(
        yield_curve: Dict[float, float],
        bond_maturity: float,
        coupon_rate: float,
        face_value: float = 100.0,
        bump_bp: float = 10.0,
        krd_nodes: Optional[List[float]] = None
    ) -> Dict[float, float]:
        """
        Calculates Key Rate Durations (KRD) for a bond across spot rate maturity nodes.

        Uses triangular tent functions to perturb spot rates at key rate nodes.
        KRD_k = - (P(y + delta_k) - P(y - delta_k)) / (2 * delta * P_base)
        """
        if krd_nodes is None:
            krd_nodes = DEFAULT_KRD_NODES

        nodes = sorted(krd_nodes)

        # Helper to price bond given spot curve mapping
        def price_bond_with_curve(curve: Dict[float, float]) -> float:
            # Interpolate yield curve for cash flow dates
            # Semi-annual cash flows
            n_periods = int(round(bond_maturity * 2))
            if n_periods == 0:
                n_periods = 1
            cash_flows = []
            times = []
            for t_i in range(1, n_periods + 1):
                t_years = t_i / 2.0
                times.append(t_years)
                cf = (coupon_rate / 2.0) * face_value
                if t_i == n_periods:
                    cf += face_value
                cash_flows.append(cf)

            # Linear interpolation of spot rate for each cash flow time
            price = 0.0
            sorted_mats = sorted(curve.keys())
            rates = [curve[m] for m in sorted_mats]

            for t_years, cf in zip(times, cash_flows):
                r_t = np.interp(t_years, sorted_mats, rates)
                price += cf / ((1.0 + r_t / 200.0) ** (2.0 * t_years))
            return price

        base_price = price_bond_with_curve(yield_curve)
        if base_price <= 0:
            return {node: 0.0 for node in nodes}

        delta = bump_bp / 10000.0  # e.g. 10 bps = 0.0010
        krds = {}

        for i, node in enumerate(nodes):
            # Construct perturbed curve for node i using tent function
            curve_up = yield_curve.copy()
            curve_down = yield_curve.copy()

            for mat in yield_curve.keys():
                # Determine weight of tent function centered at nodes[i]
                if i == 0:
                    if mat <= nodes[0]:
                        w = 1.0
                    elif mat < nodes[1]:
                        w = (nodes[1] - mat) / (nodes[1] - nodes[0])
                    else:
                        w = 0.0
                elif i == len(nodes) - 1:
                    if mat >= nodes[-1]:
                        w = 1.0
                    elif mat > nodes[-2]:
                        w = (mat - nodes[-2]) / (nodes[-1] - nodes[-2])
                    else:
                        w = 0.0
                else:
                    if nodes[i - 1] < mat <= nodes[i]:
                        w = (mat - nodes[i - 1]) / (nodes[i] - nodes[i - 1])
                    elif nodes[i] < mat < nodes[i + 1]:
                        w = (nodes[i + 1] - mat) / (nodes[i + 1] - nodes[i])
                    else:
                        w = 0.0

                curve_up[mat] += w * bump_bp
                curve_down[mat] -= w * bump_bp

            price_up = price_bond_with_curve(curve_up)
            price_down = price_bond_with_curve(curve_down)

            # KRD formula: - (P_up - P_down) / (2 * delta * P_base)
            krd_val = - (price_up - price_down) / (2.0 * delta * base_price)
            krds[node] = float(krd_val)

        return krds

    @staticmethod
    def portfolio_krd_exposure(
        holdings_weights: Dict[str, float],
        bonds_krd: Dict[str, Dict[float, float]]
    ) -> Dict[float, float]:
        """
        Aggregates Key Rate Duration (KRD) profiles across portfolio holdings weighted by asset weights.
        """
        all_nodes = set()
        for krd_dict in bonds_krd.values():
            all_nodes.update(krd_dict.keys())

        nodes = sorted(list(all_nodes))
        port_krd = {node: 0.0 for node in nodes}

        for asset, weight in holdings_weights.items():
            if asset in bonds_krd:
                for node in nodes:
                    port_krd[node] += weight * bonds_krd[asset].get(node, 0.0)

        return port_krd
