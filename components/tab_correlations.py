import numpy as np
import pandas as pd
import plotly.figure_factory as ff
import plotly.graph_objects as go
import scipy.cluster.hierarchy as sch
import scipy.spatial.distance as ssd
import streamlit as st
from data_loader import ETF_MAP, GROUP_MAP


def render_correlations_tab(corr_dict):
    """Renders Tab 3: Cross-Asset Correlations & Hierarchical Clustering Dendrogram."""
    st.markdown("### 🔀 Cross-Asset Sector & Asset Class Correlations")
    st.caption("Cross-asset correlation matrix and hierarchical clustering dendrogram across 43 ETF asset class proxies.")

    st.markdown("---")

    selected_window = st.selectbox(
        "Select Correlation Lookback Horizon:",
        ["5-Year", "2-Year", "63-Day (Quarterly)", "20-Day (Monthly)"],
        index=0,
        key="corr_horizon_select",
    )

    corr_df = corr_dict.get(selected_window)

    if corr_df is None or corr_df.empty:
        st.warning("Correlation matrix data unavailable.")
        return

    # Use ONLY the mapped descriptive ETF names on the axes
    mapped_labels = [ETF_MAP.get(ticker, ticker) for ticker in corr_df.columns]

    # ==========================================
    # SUBPLOT 1: ETF Correlation Heatmap
    # ==========================================
    st.markdown(f"#### Subplot 1: Cross-Asset ETF Correlation Matrix ({selected_window})")

    fig_heatmap = go.Figure(
        data=go.Heatmap(
            z=corr_df.values,
            x=mapped_labels,
            y=mapped_labels,
            colorscale="RdBu_r",
            zmin=-1.0,
            zmax=1.0,
            colorbar=dict(title="Correlation", tickvals=[-1.0, -0.5, 0.0, 0.5, 1.0]),
            hovertemplate="<b>%{x}</b><br>vs.<br><b>%{y}</b><br>Correlation: <b>%{z:.2f}</b><extra></extra>",
        )
    )

    fig_heatmap.update_layout(
        template="plotly_dark",
        paper_bgcolor="#131722",
        plot_bgcolor="#1E222D",
        height=850,
        margin=dict(l=150, r=40, t=40, b=150),
        xaxis=dict(tickangle=-45, showgrid=False, tickfont=dict(color="#F3F4F6", size=10)),
        yaxis=dict(showgrid=False, autorange="reversed", tickfont=dict(color="#F3F4F6", size=10)),
    )

    st.plotly_chart(fig_heatmap, use_container_width=True)

    st.markdown("---")

    # ==========================================
    # SUBPLOT 2: Hierarchical Clustering Dendrogram
    # ==========================================
    st.markdown("#### Subplot 2: Asset Class Hierarchical Clustering Dendrogram")
    st.caption("Dendrogram tree showing clustering of asset classes based on correlation distance matrix (Distance = 1 - Correlation).")

    dist_matrix = 1.0 - corr_df.values
    np.fill_diagonal(dist_matrix, 0.0)
    dist_matrix = (dist_matrix + dist_matrix.T) / 2.0
    dist_matrix = np.clip(dist_matrix, 0.0, 2.0)

    condensed_dist = ssd.squareform(dist_matrix, checks=False)
    linkage_matrix = sch.linkage(condensed_dist, method="ward")

    fig_dendro = ff.create_dendrogram(
        dist_matrix,
        orientation="bottom",
        labels=mapped_labels,
        linkagefun=lambda x: linkage_matrix,
        color_threshold=0.7,
    )

    fig_dendro.update_layout(
        template="plotly_dark",
        paper_bgcolor="#131722",
        plot_bgcolor="#1E222D",
        height=550,
        margin=dict(l=40, r=40, t=40, b=140),
        xaxis=dict(title=dict(text="ETF Asset Class Proxies", font=dict(color="#F3F4F6")), tickangle=-45, showgrid=False, tickfont=dict(color="#F3F4F6", size=10)),
        yaxis=dict(title=dict(text="Correlation Distance (Ward's Linkage)", font=dict(color="#F3F4F6")), showgrid=True, gridcolor="#2A2E39", tickfont=dict(color="#F3F4F6")),
    )

    st.plotly_chart(fig_dendro, use_container_width=True)
