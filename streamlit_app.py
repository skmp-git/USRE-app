import datetime
import streamlit as st
import data_loader
from components.tab_cross_asset import render_cross_asset_tab
from components.tab_treasury_fedwatch import render_treasury_fedwatch_tab
from components.tab_correlations import render_correlations_tab

# Streamlit Page Configuration
st.set_page_config(
    page_title="Financial Market Dashboard | Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Dark Mode Terminal Aesthetic CSS
CUSTOM_CSS = """
<style>
    /* Dark Mode Base Theme */
    .stApp {
        background-color: #0E1117;
        color: #F3F4F6;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', Roboto, sans-serif;
    }

    /* Top Navigation Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #1E222D;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #2A2E39;
    }

    .stTabs [data-baseweb="tab"] {
        height: 42px;
        border-radius: 6px;
        color: #9CA3AF;
        font-weight: 600;
        font-size: 0.95rem;
        background-color: transparent;
        border: none;
        padding: 0px 20px;
    }

    .stTabs [aria-selected="true"] {
        background-color: #2A2E39 !important;
        color: #3B82F6 !important;
        border-bottom: 2.5px solid #3B82F6 !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    /* Header Bar */
    .terminal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(90deg, #131722 0%, #1E222D 100%);
        padding: 14px 24px;
        border-radius: 8px;
        border: 1px solid #2A2E39;
        margin-bottom: 20px;
    }

    .terminal-title {
        color: #60A5FA;
        font-size: 1.4rem;
        font-weight: 800;
        letter-spacing: 0.5px;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .terminal-status {
        font-size: 0.85rem;
        color: #10B981;
        background: rgba(16, 185, 129, 0.15);
        padding: 4px 12px;
        border-radius: 12px;
        border: 1px solid rgba(16, 185, 129, 0.4);
        font-weight: 600;
        font-family: monospace;
    }

    /* Metric Cards and Accordion Styling */
    .stExpander {
        background-color: #131722 !important;
        border: 1px solid #2A2E39 !important;
        border-radius: 8px !important;
        margin-bottom: 12px !important;
    }

    /* Hide standard Streamlit header and footer */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
"""

st.markdown(CUSTOM_CSS, unsafe_allow_html=True)


def main():
    # Top Header Bar
    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    st.markdown(
        f"""
        <div class="terminal-header">
            <div class="terminal-title">
                📈 Financial Market Dashboard | Terminal Pro
            </div>
            <div class="terminal-status">
                ● LIVE CONNECTED | {now_utc}
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Hydrate Data
    with st.spinner("Hydrating financial market data feeds..."):
        df_cross_asset = data_loader.fetch_cross_asset_data()
        yield_curves_df, daily_shifts_df, weekly_shifts_df = data_loader.fetch_treasury_yield_data()
        fomc_df = data_loader.fetch_fomc_probabilities()
        dot_plot_df, dot_medians = data_loader.fetch_fomc_dot_plot_data()
        corr_dict, _ = data_loader.fetch_correlation_etf_data()

    # Top-level Horizontal Tab Navigation (3 Tabs)
    tab1, tab2, tab3 = st.tabs(
        [
            "🌐 Tab 1: Cross-Asset Sector Performance",
            "🏛️ Tab 2: Treasury Yield Curve & FOMC Rate Probabilities",
            "🔀 Tab 3: Cross-Asset Correlations",
        ]
    )

    with tab1:
        render_cross_asset_tab(df_cross_asset)

    with tab2:
        render_treasury_fedwatch_tab(yield_curves_df, daily_shifts_df, weekly_shifts_df, fomc_df, dot_plot_df, dot_medians)

    with tab3:
        render_correlations_tab(corr_dict)


if __name__ == "__main__":
    main()
