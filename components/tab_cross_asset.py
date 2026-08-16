import pandas as pd
import streamlit as st
from utils.formatting import render_sparkline_fig


def render_cross_asset_tab(df_cross_asset):
    """Renders Tab 1: Cross-Asset Sector Performance Dashboard."""
    st.markdown("### 📊 Cross-Asset Sector Performance Matrix")
    st.caption(
        "Sortable cross-asset market grid tracking Week-to-Date (WTD), Month-to-Date (MTD), "
        "and Year-to-Date (YTD) total returns with 5-day trailing sparklines."
    )

    if df_cross_asset.empty:
        st.warning("No cross-asset data available.")
        return

    categories = df_cross_asset["Category"].unique().tolist()

    # Sort controls
    sort_col1, sort_col2 = st.columns([2, 3])
    with sort_col1:
        metric_sort = st.selectbox(
            "Sort Matrix By:",
            ["Ticker", "Name", "WTD (%)", "MTD (%)", "YTD (%)"],
            index=4,  # YTD default
            key="ca_sort_metric",
        )
    with sort_col2:
        sort_order = st.radio(
            "Order:",
            ["Descending (Highest First)", "Ascending (Lowest First)"],
            horizontal=True,
            key="ca_sort_order",
        )

    ascending = "Ascending" in sort_order

    st.markdown("---")

    for cat in categories:
        cat_df = df_cross_asset[df_cross_asset["Category"] == cat].copy()
        if metric_sort in cat_df.columns:
            cat_df = cat_df.sort_values(by=metric_sort, ascending=ascending)

        with st.expander(f"📁 **{cat.upper()}** ({len(cat_df)} instruments)", expanded=True):
            # Render grid with column headers
            header_cols = st.columns([1.5, 3.0, 1.8, 1.8, 1.8, 2.5])
            header_cols[0].markdown("**Ticker**")
            header_cols[1].markdown("**Instrument Name**")
            header_cols[2].markdown("**WTD Return**")
            header_cols[3].markdown("**MTD Return**")
            header_cols[4].markdown("**YTD Return**")
            header_cols[5].markdown("**Trailing 5D Trend**")

            st.markdown("<hr style='margin: 4px 0 12px 0; border-color: #333;' />", unsafe_allow_html=True)

            for _, row in cat_df.iterrows():
                cols = st.columns([1.5, 3.0, 1.8, 1.8, 1.8, 2.5])

                cols[0].markdown(f"**`{row['Ticker']}`**")
                cols[1].markdown(f"<span style='color: #D1D5DB;'>{row['Name']}</span>", unsafe_allow_html=True)

                # WTD
                wtd = row["WTD (%)"]
                wtd_color = "#10B981" if wtd > 0 else ("#EF4444" if wtd < 0 else "#9CA3AF")
                cols[2].markdown(f"<span style='color:{wtd_color}; font-weight:600;'>{wtd:+.2f}%</span>", unsafe_allow_html=True)

                # MTD
                mtd = row["MTD (%)"]
                mtd_color = "#10B981" if mtd > 0 else ("#EF4444" if mtd < 0 else "#9CA3AF")
                cols[3].markdown(f"<span style='color:{mtd_color}; font-weight:600;'>{mtd:+.2f}%</span>", unsafe_allow_html=True)

                # YTD
                ytd = row["YTD (%)"]
                ytd_color = "#10B981" if ytd > 0 else ("#EF4444" if ytd < 0 else "#9CA3AF")
                cols[4].markdown(f"<span style='color:{ytd_color}; font-weight:600;'>{ytd:+.2f}%</span>", unsafe_allow_html=True)

                # Sparkline chart
                fig = render_sparkline_fig(row["Sparkline"])
                cols[5].plotly_chart(fig, use_container_width=True, config={"displayModeBar": False}, key=f"spark_{row['Ticker']}")
