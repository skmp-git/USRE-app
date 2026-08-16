import datetime
import streamlit as st
import data_loader
from components.tab_cross_asset import render_cross_asset_tab
from components.tab_treasury_fedwatch import render_treasury_fedwatch_tab

# Streamlit Page Configuration
st.set_page_config(
    page_title="Financial Market Dashboard | Terminal",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Dark-mode-first Financial Terminal Aesthetic CSS
CUSTOM_CSS = """
<style>
    /* Dark Terminal Base Theme */
    .stApp {
        background-color: #0E1117;
        color: #E5E7EB;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', Roboto, sans-serif;
    }

    /* Top Navigation Tabs Styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
        background-color: #161B22;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #30363D;
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
        background-color: #21262D !important;
        color: #00F0FF !important;
        border-bottom: 2px solid #00F0FF !important;
    }

    /* Header Bar */
    .terminal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(90deg, #161B22 0%, #0D1117 100%);
        padding: 14px 24px;
        border-radius: 8px;
        border: 1px solid #30363D;
        margin-bottom: 20px;
    }

    .terminal-title {
        color: #00F0FF;
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
        background: rgba(16, 185, 129, 0.12);
        padding: 4px 12px;
        border-radius: 12px;
        border: 1px solid rgba(16, 185, 129, 0.3);
        font-weight: 600;
        font-family: monospace;
    }

    /* Metric Cards and Accordion Styling */
    .stExpander {
        background-color: #161B22 !important;
        border: 1px solid #30363D !important;
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
                📈 Bloomberg Terminal Pro | Market Analytics Dashboard
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

    # Top-level Horizontal Tab Navigation
    tab1, tab2 = st.tabs(
        [
            "🌐 Tab 1: Cross-Asset Sector Performance",
            "🏛️ Tab 2: Treasury Yield Curve & FOMC Rate Probabilities",
        ]
    )

    with tab1:
        render_cross_asset_tab(df_cross_asset)

    with tab2:
        render_treasury_fedwatch_tab(yield_curves_df, daily_shifts_df, weekly_shifts_df, fomc_df)


if __name__ == "__main__":
    main()
