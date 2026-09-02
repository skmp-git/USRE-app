"""
Unit tests for systematic_fi package.
"""

import numpy as np
import pandas as pd
import pytest

from systematic_fi.data import FREDDataIngestor, DataPreprocessor, generate_synthetic_fi_data
from systematic_fi.signals import SignalEngine
from systematic_fi.transformation import SignalTransformer
from systematic_fi.risk import YieldCurveRiskManager
from systematic_fi.rebalancing import RebalanceEngine


@pytest.fixture
def sample_data():
    return generate_synthetic_fi_data(start_date="2020-01-01", end_date="2021-12-31", freq="B", seed=42)


def test_data_generation_and_preprocessor(sample_data):
    assert len(sample_data) > 100
    assert "yield_10y" in sample_data.columns
    assert "inflation_10y" in sample_data.columns

    cleaned = DataPreprocessor.clean_and_align(sample_data)
    assert not cleaned.isnull().all().any()

    exp_med = DataPreprocessor.expanding_median(sample_data["yield_10y"], min_periods=10)
    assert len(exp_med) == len(sample_data)


def test_signal_engine(sample_data):
    real_yield = SignalEngine.compute_real_bond_yield(
        sample_data["yield_10y"], sample_data["inflation_10y"]
    )
    assert len(real_yield) == len(sample_data)
    assert real_yield.name == "real_bond_yield"

    credit_residual = SignalEngine.compute_credit_spread_residual(
        sample_data["ig_spread"],
        sample_data["profitability"],
        sample_data["leverage"],
        sample_data["equity_vol"],
        min_periods=20
    )
    assert len(credit_residual) == len(sample_data)

    rates_mom = SignalEngine.compute_rates_momentum(
        sample_data["yield_10y"],
        sample_data["bill_3m"],
        lookback_months=6,
        skip_recent_months=1
    )
    assert len(rates_mom) == len(sample_data)

    emc = SignalEngine.compute_equity_momentum_in_credit(
        sample_data["equity_price"],
        windows=(10, 20, 40, 60),
        min_periods=15
    )
    assert len(emc) == len(sample_data)

    term_spread = SignalEngine.compute_rates_carry(
        sample_data["yield_10y"], sample_data["bill_3m"]
    )
    assert len(term_spread) == len(sample_data)

    # Test overall regime classification
    agg_info = SignalEngine.classify_overall_regime(1.25)
    assert agg_info["regime"] == "AGGRESSIVE"

    def_info = SignalEngine.classify_overall_regime(0.75)
    assert def_info["regime"] == "DEFENSIVE"

    neu_info = SignalEngine.classify_overall_regime(1.00)
    assert neu_info["regime"] == "NEUTRAL"


def test_signal_transformer(sample_data):
    transformer = SignalTransformer(min_periods=20, sensitivity=0.50)
    raw_signal = SignalEngine.compute_real_bond_yield(
        sample_data["yield_10y"], sample_data["inflation_10y"]
    )

    transformed_df = transformer.transform_pipeline(raw_signal)
    assert "step1_capped" in transformed_df.columns
    assert "step2_benchmarked" in transformed_df.columns
    assert "step3_zscore" in transformed_df.columns
    assert "step4_exposure" in transformed_df.columns

    # Check bounds on step 4 exposure
    exposures = transformed_df["step4_exposure"].dropna()
    assert (exposures >= 0.50).all()
    assert (exposures <= 1.50).all()


def test_yield_curve_risk_manager():
    bonds = pd.DataFrame({
        "bond_id": ["B1", "B2", "B3"],
        "maturity": [2.0, 7.0, 20.0]
    })
    partitioned = YieldCurveRiskManager.partition_bond_universe(bonds)
    assert len(partitioned["Short"]) == 1
    assert len(partitioned["Medium"]) == 1
    assert len(partitioned["Long"]) == 1

    lsc = YieldCurveRiskManager.construct_duration_neutral_lsc(
        short_dur=2.0, med_dur=6.0, long_dur=15.0
    )
    assert "Level" in lsc
    assert "Slope" in lsc
    assert "Curvature" in lsc

    # Duration neutrality checks for slope leg (short * dur + long * dur = 0)
    slope_dur = lsc["Slope"]["Short"] * 2.0 + lsc["Slope"]["Long"] * 15.0
    assert abs(slope_dur) < 1e-6

    # Key rate durations test
    yield_curve = {0.25: 1.0, 2.0: 1.5, 5.0: 2.0, 10.0: 2.5, 30.0: 3.0}
    krds = YieldCurveRiskManager.compute_key_rate_durations(
        yield_curve=yield_curve,
        bond_maturity=10.0,
        coupon_rate=2.5,
        krd_nodes=[0.25, 2.0, 5.0, 10.0, 30.0]
    )
    assert len(krds) == 5
    assert sum(krds.values()) > 0  # Sum of KRDs should be approx Macaulay/Modified duration


def test_rebalance_engine():
    engine = RebalanceEngine(tc_threshold=0.05, cash_threshold=0.05)

    curr_w = {"Short": 0.40, "Medium": 0.40, "Long": 0.20}
    targ_w = {"Short": 0.30, "Medium": 0.30, "Long": 0.40}

    tc_dist = engine.calculate_transfer_coefficient_distance(curr_w, targ_w)
    assert tc_dist > 0

    res = engine.evaluate_rebalance_trigger(
        current_weights=curr_w,
        target_weights=targ_w,
        uninvested_cash=10000.0,
        total_portfolio_value=100000.0
    )
    assert res["should_rebalance"] is True
    assert res["cash_trigger"] is True

    trades = engine.generate_rebalance_trades(curr_w, targ_w, total_portfolio_value=100000.0)
    assert len(trades) == 3
    assert trades.loc["Long", "dollar_trade"] > 0
