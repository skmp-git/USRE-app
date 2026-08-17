import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from utils.analytics import classify_yield_curve_regime


def render_treasury_fedwatch_tab(yield_curves_df, daily_shifts_df, weekly_shifts_df, fomc_df, dot_plot_df, dot_medians):
    """Renders Tab 2: US Treasury Yield Curve Analytics & FOMC Interest Rate Probabilities."""
    st.markdown("### 🏛️ US Treasury Yield Curve Analytics & FOMC Rate Probabilities")
    st.caption("Fixed-income analytical engine tracking active yield curve curves, macro curve regime shifts, CME FedWatch implied rate probabilities, and FOMC Dot Plot projections.")

    st.markdown("---")

    # ==========================================
    # COMPONENT A: Active US Treasury Yield Curve Engine
    # ==========================================
    st.markdown("#### Component A: Active US Treasury Yield Curve Engine")

    if yield_curves_df.empty:
        st.warning("Yield curve data unavailable.")
    else:
        tenors = yield_curves_df["Tenor"].tolist()
        curr_yields = yield_curves_df["Current"].tolist() if "Current" in yield_curves_df else [4.0] * len(tenors)
        one_m_yields = yield_curves_df["1 Month Ago"].tolist() if "1 Month Ago" in yield_curves_df else [4.1] * len(tenors)
        ye_yields = yield_curves_df["Last Year End"].tolist() if "Last Year End" in yield_curves_df else [4.2] * len(tenors)

        fig_curve = go.Figure()

        # 1. Current (Solid Bold Line)
        fig_curve.add_trace(
            go.Scatter(
                x=tenors,
                y=curr_yields,
                mode="lines+markers",
                name="Current (Live / Close)",
                line=dict(color="#2563EB", width=4),
                marker=dict(size=8, color="#2563EB"),
                hovertemplate="<b>Tenor:</b> %{x}<br><b>Current Yield:</b> %{y:.2f}%<extra></extra>",
            )
        )

        # 2. 1 Month Ago (Dashed Line)
        fig_curve.add_trace(
            go.Scatter(
                x=tenors,
                y=one_m_yields,
                mode="lines+markers",
                name="1 Month Ago",
                line=dict(color="#D97706", width=2.5, dash="dash"),
                marker=dict(size=6, color="#D97706"),
                hovertemplate="<b>Tenor:</b> %{x}<br><b>1M Ago Yield:</b> %{y:.2f}%<extra></extra>",
            )
        )

        # 3. Last Year End (Muted Subdued Line)
        fig_curve.add_trace(
            go.Scatter(
                x=tenors,
                y=ye_yields,
                mode="lines+markers",
                name="Last Year End",
                line=dict(color="#6B7280", width=2, dash="dot"),
                marker=dict(size=6, color="#6B7280"),
                hovertemplate="<b>Tenor:</b> %{x}<br><b>Year End Yield:</b> %{y:.2f}%<extra></extra>",
            )
        )

        fig_curve.update_layout(
            template="plotly_dark",
            paper_bgcolor="#131722",
            plot_bgcolor="#1E222D",
            height=420,
            margin=dict(l=40, r=40, t=30, b=40),
            hovermode="x unified",
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="right",
                x=1,
                font=dict(size=12, color="#F3F4F6"),
            ),
            xaxis=dict(
                title=dict(text="Maturity Tenor Bucket", font=dict(color="#F3F4F6")),
                showgrid=True,
                gridcolor="#2A2E39",
                zeroline=False,
                tickfont=dict(color="#F3F4F6"),
            ),
            yaxis=dict(
                title=dict(text="Yield to Maturity (%)", font=dict(color="#F3F4F6")),
                ticksuffix="%",
                showgrid=True,
                gridcolor="#2A2E39",
                zeroline=False,
                tickfont=dict(color="#F3F4F6"),
            ),
        )

        st.plotly_chart(fig_curve, use_container_width=True)

    st.markdown("---")

    # ==========================================
    # COMPONENT B: Curve Regime & Shape Change Analysis Subplot
    # ==========================================
    st.markdown("#### Component B: Curve Regime & Shape Change Analysis")

    filter_horizon = st.selectbox(
        "Retrospective Context Horizon:",
        ["Daily Shifts (Last 20 Days)", "Weekly Shifts (Past 12 Months)"],
        index=0,
        key="regime_horizon_select",
    )

    shifts_df = daily_shifts_df if "Daily Shifts" in filter_horizon else weekly_shifts_df

    if not shifts_df.empty and len(shifts_df) >= 2:
        short_start = shifts_df["Yield_2Y"].iloc[0]
        short_end = shifts_df["Yield_2Y"].iloc[-1]
        long_start = shifts_df["Yield_10Y"].iloc[0]
        long_end = shifts_df["Yield_10Y"].iloc[-1]

        short_delta_bps = (short_end - short_start) * 100.0
        long_delta_bps = (long_end - long_start) * 100.0

        regime_info = classify_yield_curve_regime(short_delta_bps, long_delta_bps)

        b_col1, b_col2, b_col3, b_col4 = st.columns([1.5, 1.5, 1.5, 3.5])

        b_col1.metric("2Y Yield Shift", f"{short_end:.2f}%", f"{short_delta_bps:+.2f} bps")
        b_col2.metric("10Y Yield Shift", f"{long_end:.2f}%", f"{long_delta_bps:+.2f} bps")
        spread_net_change = long_delta_bps - short_delta_bps
        b_col3.metric("10Y-2Y Spread Delta", f"{shifts_df['Spread_10Y_2Y_bps'].iloc[-1]:.2f} bps", f"{spread_net_change:+.2f} bps")

        b_col4.markdown(
            f"""
            <div style="background-color: #1F2937; border: 1.5px solid {regime_info['color']}; border-radius: 8px; padding: 12px 16px; margin-top: 4px;">
                <span style="color: {regime_info['color']}; font-weight: 700; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;">
                    ⚡ Active Regime: {regime_info['regime']}
                </span>
                <p style="color: #D1D5DB; font-size: 0.85rem; margin: 4px 0 0 0;">
                    {regime_info['description']}
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

        fig_spread = go.Figure()
        colors = ["#10B981" if val >= 0 else "#EF4444" for val in shifts_df["Spread_Change_bps"]]

        fig_spread.add_trace(
            go.Bar(
                x=shifts_df["Date"].dt.strftime("%Y-%m-%d") if "Date" in shifts_df and hasattr(shifts_df["Date"], "dt") else list(range(len(shifts_df))),
                y=shifts_df["Spread_Change_bps"],
                marker_color=colors,
                name="Spread Shift (bps)",
                hovertemplate="<b>Date:</b> %{x}<br><b>Net Change:</b> %{y:+.2f} bps<extra></extra>",
            )
        )

        fig_spread.update_layout(
            template="plotly_dark",
            paper_bgcolor="#131722",
            plot_bgcolor="#1E222D",
            height=300,
            margin=dict(l=40, r=40, t=20, b=30),
            xaxis=dict(title=dict(text="Time Horizon", font=dict(color="#F3F4F6")), showgrid=False, tickfont=dict(color="#F3F4F6")),
            yaxis=dict(title=dict(text="10Y - 2Y Spread Shift (bps)", font=dict(color="#F3F4F6")), ticksuffix=" bps", showgrid=True, gridcolor="#2A2E39", tickfont=dict(color="#F3F4F6")),
            showlegend=False,
        )

        st.plotly_chart(fig_spread, use_container_width=True)

    st.markdown("---")

    # ==========================================
    # COMPONENT C: FedWatch FOMC Rate Probability Matrix
    # ==========================================
    st.markdown("#### Component C: CME FedWatch FOMC Interest Rate Probability Matrix")

    if fomc_df.empty:
        st.warning("FOMC rate probability data unavailable.")
    else:
        st.dataframe(
            fomc_df,
            use_container_width=True,
            column_config={
                "Meeting Date": st.column_config.TextColumn("Meeting Date", help="Upcoming FOMC rate decision schedule"),
                "Expected Hikes/Cuts": st.column_config.TextColumn("Expected Hikes/Cuts", help="Implied number of 25bps rate hikes or cuts"),
                "Implied Policy Rate": st.column_config.TextColumn("Implied Policy Target Rate", help="Terminal policy target rate derived from 30-Day Fed Funds futures"),
                "Rate Change Delta (bps)": st.column_config.TextColumn("Implied Δ (bps)", help="Expected basis point shift relative to active target rate"),
                "Prob Unchanged": st.column_config.TextColumn("Prob Unchanged", help="Probability of no rate change"),
                "Prob 25bp Move": st.column_config.TextColumn("Prob 25bp Move", help="Probability of a 25bps rate move"),
                "Prob 50bp Move": st.column_config.TextColumn("Prob 50bp Move", help="Probability of a 50bps rate move"),
            },
            hide_index=True,
        )

    st.markdown("---")

    # ==========================================
    # COMPONENT D: FOMC Participants' Assessments of Appropriate Monetary Policy ("Dot Plot")
    # ==========================================
    st.markdown("#### Component D: FOMC Participants' Assessments of Appropriate Monetary Policy (\"Dot Plot\")")
    st.caption("Individual FOMC participant interest rate projections across forecast horizons alongside median policy target trajectory lines.")

    if dot_plot_df.empty:
        st.warning("FOMC Dot Plot data unavailable.")
    else:
        fig_dot = go.Figure()

        years_list = ["2025", "2026", "2027", "Longer Run"]
        year_to_x = {y: idx for idx, y in enumerate(years_list)}

        np.random.seed(42)
        x_jittered = [year_to_x[row["Year"]] + np.random.uniform(-0.12, 0.12) for _, row in dot_plot_df.iterrows()]

        fig_dot.add_trace(
            go.Scatter(
                x=x_jittered,
                y=dot_plot_df["Rate"],
                mode="markers",
                name="FOMC Participant Projections",
                marker=dict(
                    size=11,
                    color="#2563EB",
                    line=dict(width=1, color="#1E3A8A"),
                    opacity=0.85,
                ),
                text=[f"Horizon: {row['Year']}<br>Target Rate: {row['Rate']:.2f}%" for _, row in dot_plot_df.iterrows()],
                hoverinfo="text",
            )
        )

        median_x = [year_to_x[y] for y in years_list]
        median_y = [dot_medians[y] for y in years_list]

        fig_dot.add_trace(
            go.Scatter(
                x=median_x,
                y=median_y,
                mode="lines+markers",
                name="Median Target Path",
                line=dict(color="#DC2626", width=3, dash="solid"),
                marker=dict(size=10, color="#DC2626", symbol="diamond"),
                hovertemplate="<b>Horizon:</b> %{text}<br><b>Median Rate:</b> %{y:.2f}%<extra></extra>",
                text=years_list,
            )
        )

        fig_dot.update_layout(
            template="plotly_dark",
            paper_bgcolor="#131722",
            plot_bgcolor="#1E222D",
            height=450,
            margin=dict(l=40, r=40, t=30, b=40),
            xaxis=dict(
                tickmode="array",
                tickvals=list(range(len(years_list))),
                ticktext=years_list,
                title=dict(text="Forecast Horizon", font=dict(color="#F3F4F6")),
                showgrid=True,
                gridcolor="#2A2E39",
                tickfont=dict(color="#F3F4F6"),
            ),
            yaxis=dict(
                title=dict(text="Fed Funds Target Rate (%)", font=dict(color="#F3F4F6")),
                ticksuffix="%",
                showgrid=True,
                gridcolor="#2A2E39",
                dtick=0.25,
                tickfont=dict(color="#F3F4F6"),
            ),
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="right",
                x=1,
                font=dict(color="#F3F4F6"),
            ),
        )

        st.plotly_chart(fig_dot, use_container_width=True)
