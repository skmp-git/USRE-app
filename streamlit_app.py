import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px

from systematic_fi.data import FREDDataIngestor, DataPreprocessor, generate_synthetic_fi_data
from systematic_fi.signals import SignalEngine
from systematic_fi.transformation import SignalTransformer
from systematic_fi.risk import YieldCurveRiskManager
from systematic_fi.rebalancing import RebalanceEngine

st.set_page_config(page_title="Systematic Fixed Income Portfolio Engine", layout="wide")

st.title("🏦 Systematic Fixed Income Asset Allocation & Signal Engine")
st.markdown(
    """
    **Family Office Quantitative Portfolio Framework**
    *Production-ready modular architecture for sovereign bond yields, credit spreads, multi-factor signals, expanding transformations, yield curve risk, and automated rebalancing.*
    """
)

# Sidebar controls
st.sidebar.header("Configuration & Controls")
data_source = st.sidebar.radio("Data Source", ["Synthetic Generator (Offline / Demo)", "Live FRED API / CSV Download"])

start_year = st.sidebar.slider("Start Year", 2005, 2020, 2010)
end_year = st.sidebar.slider("End Year", 2021, 2025, 2024)

# Signal pipeline settings
st.sidebar.subheader("Transformation Pipeline Settings")
lower_q = st.sidebar.slider("Lower Quantile (Step 1)", 0.01, 0.10, 0.05, 0.01)
upper_q = st.sidebar.slider("Upper Quantile (Step 1)", 0.90, 0.99, 0.95, 0.01)
sensitivity = st.sidebar.slider("Timing Sensitivity (Step 4)", 0.1, 1.0, 0.5, 0.05)

# Load Data
@st.cache_data
def load_data(source_type, start, end):
    if source_type == "Live FRED API / CSV Download":
        ingestor = FREDDataIngestor()
        df = ingestor.fetch_multiple_series(
            start_date=f"{start}-01-01",
            end_date=f"{end}-12-31",
            fallback_synthetic=True
        )
    else:
        df = generate_synthetic_fi_data(
            start_date=f"{start}-01-01",
            end_date=f"{end}-12-31"
        )
    return DataPreprocessor.clean_and_align(df)

data_load_state = st.text("Loading market yield data...")
df_market = load_data(data_source, start_year, end_year)
data_load_state.text("Data loaded successfully!")

tabs = st.tabs([
    "1. Data Ingestion",
    "2. Signal Generation",
    "3. 4-Step Transformation",
    "4. Yield Curve & Risk",
    "5. Rebalancing Engine"
])

# Tab 1: Data Ingestion
with tabs[0]:
    st.header("1. Historical Yield & Credit Data Time Series")
    st.caption("Chronologically processed time series with zero lookahead bias.")

    col1, col2 = st.columns([3, 1])
    with col1:
        fig = go.Figure()
        for col in ["bill_3m", "yield_2y", "yield_5y", "yield_10y", "yield_30y"]:
            if col in df_market.columns:
                fig.add_trace(go.Scatter(x=df_market.index, y=df_market[col], name=col))
        fig.update_layout(
            title="Sovereign Yield Curve Time Series (%)",
            title_font=dict(size=16),
            xaxis_title="Date",
            yaxis_title="Yield (%)",
            hovermode="x unified"
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("Latest Rates")
        latest = df_market.iloc[-1]
        st.metric("3M Bill Rate", f"{latest.get('bill_3m', 0.0):.2f}%")
        st.metric("10Y Treasury", f"{latest.get('yield_10y', 0.0):.2f}%")
        st.metric("10Y Inflation Exp", f"{latest.get('inflation_10y', 0.0):.2f}%")
        st.metric("IG Credit Spread", f"{latest.get('ig_spread', 0.0):.2f}%")

# Tab 2: Signal Generation
with tabs[1]:
    st.header("2. Quantitative Signal Generation Engine")

    # Compute signals
    real_yield = SignalEngine.compute_real_bond_yield(df_market["yield_10y"], df_market["inflation_10y"])
    credit_residual = SignalEngine.compute_credit_spread_residual(
        df_market["ig_spread"], df_market["profitability"], df_market["leverage"], df_market["equity_vol"]
    )
    rates_mom = SignalEngine.compute_rates_momentum(df_market["yield_10y"], df_market["bill_3m"])
    emc_composite = SignalEngine.compute_equity_momentum_in_credit(df_market["equity_price"])
    term_spread = SignalEngine.compute_rates_carry(df_market["yield_10y"], df_market["bill_3m"])

    signals_df = pd.DataFrame({
        "Real Bond Yield (Value)": real_yield,
        "Credit Spread Residual (Value)": credit_residual,
        "Rates Momentum (12M Ex t-1)": rates_mom,
        "EMC Composite (Credit Mom)": emc_composite,
        "Rates Term Spread (Carry)": term_spread,
        "Credit Spread (Carry)": df_market["ig_spread"]
    })

    sig_choice = st.selectbox("Select Signal to Inspect", signals_df.columns)

    fig_sig = go.Figure()
    fig_sig.add_trace(go.Scatter(x=signals_df.index, y=signals_df[sig_choice], name=sig_choice, line=dict(color="#1f77b4")))
    fig_sig.update_layout(
        title=f"Raw Signal: {sig_choice}",
        title_font=dict(size=16),
        xaxis_title="Date",
        yaxis_title="Raw Value"
    )
    st.plotly_chart(fig_sig, use_container_width=True)

# Tab 3: 4-Step Transformation Pipeline
with tabs[2]:
    st.header("3. Standardized Four-Step Signal Normalization Pipeline")
    st.markdown(
        """
        - **Step 1:** Capping & flooring at expanding 95th / 5th percentiles.
        - **Step 2:** Benchmarking via expanding median subtraction.
        - **Step 3:** Volatility scaling dividing by non-parametric percentile spread.
        - **Step 4:** Timing curve mapping to bounded invested exposure [50%, 150%].
        """
    )

    transformer = SignalTransformer(
        lower_quantile=lower_q,
        upper_quantile=upper_q,
        sensitivity=sensitivity
    )
    selected_raw = signals_df[sig_choice].dropna()
    pipe_df = transformer.transform_pipeline(selected_raw)

    st.subheader(f"Pipeline Execution Breakdown for '{sig_choice}'")

    col_a, col_b = st.columns(2)
    with col_a:
        fig_p1 = go.Figure()
        fig_p1.add_trace(go.Scatter(x=pipe_df.index, y=pipe_df["raw_signal"], name="Raw Signal", opacity=0.5))
        fig_p1.add_trace(go.Scatter(x=pipe_df.index, y=pipe_df["step1_capped"], name="Step 1 Capped"))
        fig_p1.update_layout(title="Step 1: Extreme Value Capping (Expanding 5th/95th)", title_font=dict(size=14))
        st.plotly_chart(fig_p1, use_container_width=True)

    with col_b:
        fig_p2 = go.Figure()
        fig_p2.add_trace(go.Scatter(x=pipe_df.index, y=pipe_df["step2_benchmarked"], name="Step 2 Benchmarked", line=dict(color="orange")))
        fig_p2.update_layout(title="Step 2: Median-Adjusted Benchmarked Signal", title_font=dict(size=14))
        st.plotly_chart(fig_p2, use_container_width=True)

    col_c, col_d = st.columns(2)
    with col_c:
        fig_p3 = go.Figure()
        fig_p3.add_trace(go.Scatter(x=pipe_df.index, y=pipe_df["step3_zscore"], name="Step 3 Z-Score", line=dict(color="purple")))
        fig_p3.update_layout(title="Step 3: Volatility-Scaled Z-Score", title_font=dict(size=14))
        st.plotly_chart(fig_p3, use_container_width=True)

    with col_d:
        fig_p4 = go.Figure()
        fig_p4.add_trace(go.Scatter(x=pipe_df.index, y=pipe_df["step4_exposure"], name="Step 4 Invested Exposure", line=dict(color="green")))
        fig_p4.update_layout(title="Step 4: Timing Curve Invested Exposure [50%, 150%]", title_font=dict(size=14))
        st.plotly_chart(fig_p4, use_container_width=True)

# Tab 4: Yield Curve & Risk
with tabs[3]:
    st.header("4. Yield Curve Decomposition & Risk Management")

    st.subheader("A. Maturity Bucketing & Duration-Neutral LSC Assets")
    c1, c2, c3 = st.columns(3)
    s_dur = c1.number_input("Short Bucket (1-5Y) Duration", value=2.5, step=0.1)
    m_dur = c2.number_input("Medium Bucket (5-10Y) Duration", value=6.5, step=0.1)
    l_dur = c3.number_input("Long Bucket (10-30Y) Duration", value=16.0, step=0.1)

    lsc_weights = YieldCurveRiskManager.construct_duration_neutral_lsc(s_dur, m_dur, l_dur)
    st.dataframe(pd.DataFrame(lsc_weights).style.format("{:.4f}"))

    st.subheader("B. Key Rate Durations (KRD) Across Spot Maturity Nodes")
    yield_curve_snapshot = {0.25: df_market["bill_3m"].iloc[-1], 2.0: df_market["yield_2y"].iloc[-1],
                            5.0: df_market["yield_5y"].iloc[-1], 10.0: df_market["yield_10y"].iloc[-1],
                            30.0: df_market["yield_30y"].iloc[-1]}

    krd_res = YieldCurveRiskManager.compute_key_rate_durations(
        yield_curve=yield_curve_snapshot,
        bond_maturity=10.0,
        coupon_rate=3.0,
        bump_bp=10.0
    )

    fig_krd = px.bar(
        x=[f"{k}Y" for k in krd_res.keys()],
        y=list(krd_res.values()),
        labels={"x": "Key Rate Maturity Node", "y": "Key Rate Duration (KRD)"},
        title="10-Year Bond Key Rate Duration Sensitivity Profile"
    )
    fig_krd.update_layout(title_font=dict(size=16))
    st.plotly_chart(fig_krd, use_container_width=True)

# Tab 5: Rebalancing Engine
with tabs[4]:
    st.header("5. Portfolio Rebalancing & Turnover Engine")

    st.subheader("Transfer Coefficient (TC) Drift & Automated Triggers")

    tc_thresh = st.slider("TC Drift Distance Threshold", 0.01, 0.20, 0.05, 0.01)
    cash_thresh = st.slider("Uninvested Cash Trigger Ratio", 0.01, 0.15, 0.05, 0.01)

    rebal_engine = RebalanceEngine(tc_threshold=tc_thresh, cash_threshold=cash_thresh)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Current Portfolio Holdings (%)**")
        curr_short = st.number_input("Current Short Weight", value=0.45)
        curr_med = st.number_input("Current Medium Weight", value=0.35)
        curr_long = st.number_input("Current Long Weight", value=0.20)
        uninvested_cash = st.number_input("Uninvested Cash ($)", value=60000.0)
        total_val = st.number_input("Total Portfolio Value ($)", value=1000000.0)

    with col2:
        st.markdown("**Target Systematic Allocation (%)**")
        targ_short = st.number_input("Target Short Weight", value=0.30)
        targ_med = st.number_input("Target Medium Weight", value=0.40)
        targ_long = st.number_input("Target Long Weight", value=0.30)

    curr_w_dict = {"Short": curr_short, "Medium": curr_med, "Long": curr_long}
    targ_w_dict = {"Short": targ_short, "Medium": targ_med, "Long": targ_long}

    eval_res = rebal_engine.evaluate_rebalance_trigger(
        current_weights=curr_w_dict,
        target_weights=targ_w_dict,
        uninvested_cash=uninvested_cash,
        total_portfolio_value=total_val
    )

    st.markdown("---")
    st.subheader("Rebalancing Status & Output")
    if eval_res["should_rebalance"]:
        st.error(f"🚨 REBALANCE TRIGGERED: {eval_res['reason']}")
    else:
        st.success(f"✅ NO REBALANCE REQUIRED: {eval_res['reason']}")

    st.metric("TC Drift Separation Distance", f"{eval_res['tc_distance']:.4f}")
    st.metric("Cash Accumulation Ratio", f"{eval_res['cash_ratio']:.2%}")

    trades_df = rebal_engine.generate_rebalance_trades(curr_w_dict, targ_w_dict, total_val)
    st.markdown("**Generated Execution Trades:**")
    st.dataframe(trades_df.style.format({
        "current_weight": "{:.2%}",
        "target_weight": "{:.2%}",
        "weight_change": "{:.2%}",
        "dollar_trade": "${:,.2f}"
    }))
