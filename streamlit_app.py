import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime

import data_engine

# -----------------------------------------------------------------------------
# Page Configuration & Pitch-Black Theme
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="BLOOMBERG TERMINAL RESEARCH DASHBOARD",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Load CSS Custom Styling
def load_css():
    try:
        with open("style.css") as f:
            st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)
    except Exception:
        pass

load_css()

# Session State Initialization
if "ticker" not in st.session_state:
    st.session_state.ticker = "AAPL"
if "focus_pane" not in st.session_state:
    st.session_state.focus_pane = "ALL"
if "chart_period" not in st.session_state:
    st.session_state.chart_period = "1y"

# -----------------------------------------------------------------------------
# Top Header
# -----------------------------------------------------------------------------
st.markdown("""<div class="bb-status-bar">
<div>
<span class="bb-status-logo">BLOOMBERG</span>
<span style="margin-left:12px; color:#8A8D9B;">TERMINAL RESEARCH DASHBOARD | SINGLE-PAGE MULTI-PANE GRID</span>
</div>
<div>
<span class="bb-live-indicator"></span><span style="color:#00FF66; font-weight:bold;">LIVE CONNECTED</span>
<span style="margin-left:15px; color:#FFC000;">{}</span>
</div>
</div>""".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")), unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# Top Pane: Real-Time Scrolling Ticker Ribbon
# -----------------------------------------------------------------------------
ticker_data = data_engine.get_world_indices()
ribbon_items_html = ""
for item in ticker_data:
    cls = "ticker-up" if item["change"] >= 0 else "ticker-down"
    sign = "+" if item["change"] >= 0 else ""
    ribbon_items_html += f'<span class="ticker-item"><span class="ticker-symbol">{item["symbol"]}</span><span class="ticker-price">${item["price"]:,.2f}</span><span class="{cls}">{sign}{item["change"]:.2f} ({sign}{item["pctChange"]:.2f}%)</span></span>'

st.markdown(f'<div class="ticker-ribbon-wrapper"><div class="ticker-ribbon-content">{ribbon_items_html}{ribbon_items_html}</div></div>', unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# Command Prompt Bar & Window Focus Switcher
# -----------------------------------------------------------------------------
c_bar1, c_bar2, c_bar3 = st.columns([2.5, 1.8, 1])

with c_bar1:
    cmd_val = st.text_input(
        "TERMINAL COMMAND PROMPT",
        value=f"{st.session_state.ticker}",
        key="cmd_ticker_input",
        placeholder="Type Ticker (e.g. AAPL, WIRP, FI) or Shortcut <GO>"
    )

with c_bar2:
    pane_focus = st.selectbox(
        "WIDGET WINDOW FOCUS",
        ["ALL PANES (Multi-Grid)", "PANE 1: Stock Lookup", "PANE 2: Interactive Chart", "PANE 3: News Stream", "PANE 4: SEC Filings Table", "PANE 5: World Interest Rates & Fixed Income (WIRP/FI)"],
        index=0,
        key="pane_focus_select"
    )

with c_bar3:
    if st.button("EXECUTE <GO>", key="exec_go_btn"):
        if cmd_val.strip():
            parsed_cmd = cmd_val.strip().upper()
            if parsed_cmd in ["WIRP", "FI", "RATES", "BONDS"]:
                st.session_state.focus_pane = "PANE 5"
            else:
                st.session_state.ticker = parsed_cmd

current_ticker = st.session_state.ticker
info = data_engine.get_stock_info(current_ticker)

# Rate Limit Fail-safe banner notice
if info.get("isCached", False):
    st.markdown('<div style="background-color: #221100; border: 1px solid #FF9900; color: #FFC000; padding: 4px 10px; font-size: 12px; margin-bottom: 8px;">⚠️ <strong>FAIL-SAFE ACTIVATED:</strong> API Rate Limit (429) or connection delay detected. Terminal smoothly switched to local cached data feed.</div>', unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# Multi-Pane Terminal Grid Layout
# -----------------------------------------------------------------------------
focus_mode = pane_focus.split(":")[0]

if focus_mode in ["ALL PANES (Multi-Grid)", "PANE 1", "PANE 2", "PANE 3"]:
    top_grid_col1, top_grid_col2, top_grid_col3 = st.columns([1.1, 2.2, 1.2])

    # -------------------------------------------------------------------------
    # LEFT PANE: Stock Lookup & Company Fundamentals
    # -------------------------------------------------------------------------
    with top_grid_col1:
        st.markdown(f'<div class="terminal-pane {"terminal-pane-active" if focus_mode=="PANE 1" else ""}"><div class="terminal-pane-header"><span>[PANE 1] STOCK LOOKUP & FUNDAMENTALS</span><span style="color:#00E5FF;">{info["symbol"]}</span></div></div>', unsafe_allow_html=True)

        price_cls = "ticker-up" if info["change"] >= 0 else "ticker-down"
        sign = "+" if info["change"] >= 0 else ""

        st.markdown(f'<div style="padding: 4px 0; border-bottom: 1px solid #332200; margin-bottom: 8px;"><div style="font-size: 22px; font-weight: bold; color: #FFC000;">${info["currentPrice"]:.2f}</div><div class="{price_cls}" style="font-size: 14px;">{sign}{info["change"]:.2f} ({sign}{info["pctChange"]:.2f}%)</div><div style="color: #8A8D9B; font-size: 11px; margin-top: 2px;">{info["longName"]} | {info["sector"]}</div></div>', unsafe_allow_html=True)

        m1, m2 = st.columns(2)
        m1.metric("MARKET CAP", f"${info['marketCap']:,.0f}" if isinstance(info['marketCap'], (int, float)) else info['marketCap'])
        m2.metric("TRAILING P/E", f"{info['peRatio']:.2f}" if isinstance(info['peRatio'], (int, float)) else info['peRatio'])

        m3, m4 = st.columns(2)
        m3.metric("52W HIGH", f"${info['fiftyTwoWeekHigh']:.2f}" if isinstance(info['fiftyTwoWeekHigh'], (int, float)) else info['fiftyTwoWeekHigh'])
        m4.metric("52W LOW", f"${info['fiftyTwoWeekLow']:.2f}" if isinstance(info['fiftyTwoWeekLow'], (int, float)) else info['fiftyTwoWeekLow'])

        m5, m6 = st.columns(2)
        m5.metric("FORWARD P/E", f"{info['forwardPE']:.2f}" if isinstance(info['forwardPE'], (int, float)) else info['forwardPE'])
        div_str = f"{info['dividendYield']:.2f}%" if info['dividendYield'] > 0.1 else f"{info['dividendYield']*100:.2f}%"
        m6.metric("DIV YIELD", div_str)

        st.markdown("##### PROFILE SUMMARY")
        st.write(info['summary'][:280] + "...")

    # -------------------------------------------------------------------------
    # CENTER PANE: Interactive Financial Chart (Price & Volume)
    # -------------------------------------------------------------------------
    with top_grid_col2:
        st.markdown(f'<div class="terminal-pane {"terminal-pane-active" if focus_mode=="PANE 2" else ""}"><div class="terminal-pane-header"><span>[PANE 2] INTERACTIVE CHART (PRICE & VOLUME)</span><span style="color:#FFB000;">{current_ticker} - OHLCV</span></div></div>', unsafe_allow_html=True)

        chart_tf = st.radio("Timeframe", ["1mo", "3mo", "6mo", "1y", "5y"], index=3, horizontal=True, key="chart_tf_radio")
        df_hist = data_engine.get_historical_data(current_ticker, period=chart_tf)

        if not df_hist.empty:
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                vertical_spacing=0.03,
                subplot_titles=(f"{current_ticker} PRICE ACTION & TECHNICALS", "VOLUME"),
                row_heights=[0.75, 0.25]
            )

            # Price Candlestick Trace
            fig.add_trace(go.Candlestick(
                x=df_hist.index,
                open=df_hist['Open'],
                high=df_hist['High'],
                low=df_hist['Low'],
                close=df_hist['Close'],
                name="OHLC",
                increasing_line_color='#00FF66',
                decreasing_line_color='#FF3333'
            ), row=1, col=1)

            # Moving Averages
            if 'SMA_20' in df_hist:
                fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['SMA_20'], line=dict(color='#00E5FF', width=1.5), name='SMA 20'), row=1, col=1)
            if 'SMA_50' in df_hist:
                fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['SMA_50'], line=dict(color='#FF00FF', width=1.5), name='SMA 50'), row=1, col=1)

            # Volume Bars
            vol_colors = ['#00FF66' if row['Close'] >= row['Open'] else '#FF3333' for _, row in df_hist.iterrows()]
            fig.add_trace(go.Bar(
                x=df_hist.index, y=df_hist['Volume'],
                marker_color=vol_colors, name="Volume", showlegend=False
            ), row=2, col=1)

            fig.update_layout(
                template="plotly_dark",
                paper_bgcolor="#000000",
                plot_bgcolor="#050505",
                font=dict(family="Share Tech Mono, monospace", color="#FFB000"),
                height=420,
                margin=dict(l=10, r=10, t=30, b=10),
                xaxis_rangeslider_visible=False,
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
            )
            fig.update_xaxes(gridcolor="#221500")
            fig.update_yaxes(gridcolor="#221500")

            st.plotly_chart(fig, use_container_width=True)

    # -------------------------------------------------------------------------
    # RIGHT PANE: Real-Time Financial News Stream
    # -------------------------------------------------------------------------
    with top_grid_col3:
        st.markdown(f'<div class="terminal-pane {"terminal-pane-active" if focus_mode=="PANE 3" else ""}"><div class="terminal-pane-header"><span>[PANE 3] REAL-TIME NEWS STREAM</span><span style="color:#00FF66;">LIVE HEADLINES</span></div></div>', unsafe_allow_html=True)

        news_items = data_engine.get_news(current_ticker)
        for idx, n in enumerate(news_items):
            expander_title = f"[{n['ticker']}] {n['time']} | {n['title'][:55]}..."
            with st.expander(expander_title, expanded=(idx == 0)):
                st.markdown(f"""
                <div style="background-color: #050505; border-left: 2px solid #FFB000; padding: 6px 8px; margin-bottom: 4px;">
                    <div style="font-size: 11px; color: #8A8D9B; margin-bottom: 4px;">
                        <span style="color: #FFB000; font-weight: bold;">PUBLISHER:</span> {n['publisher']} |
                        <span style="color: #00FF66; font-weight: bold;">TIME:</span> {n['time']}
                    </div>
                    <div style="font-size: 12px; font-weight: bold; color: #FFFFFF; margin-bottom: 6px;">
                        {n['title']}
                    </div>
                    <div style="font-size: 11px; color: #CCCCCC; line-height: 1.4; margin-bottom: 6px;">
                        {n.get('summary', 'No further detailed summary available.')}
                    </div>
                    <div style="font-size: 11px;">
                        <a href="{n['link']}" target="_blank" style="color: #00E5FF; font-weight: bold; text-decoration: underline;">[READ FULL SOURCE ARTICLE &gt;]</a>
                    </div>
                </div>
                """, unsafe_allow_html=True)

# -----------------------------------------------------------------------------
# BOTTOM PANE 4: SEC Filings Financial Metrics Data Table
# -----------------------------------------------------------------------------
if focus_mode in ["ALL PANES (Multi-Grid)", "PANE 4"]:
    st.markdown(f'<div class="terminal-pane {"terminal-pane-active" if focus_mode=="PANE 4" else ""}"><div class="terminal-pane-header"><span>[PANE 4] SEC FILINGS DETAILED FINANCIAL METRICS</span><span style="color:#FFB000;">{current_ticker} STATEMENTS</span></div></div>', unsafe_allow_html=True)

    filings_data = data_engine.get_sec_filings_data(current_ticker)
    tab_inc, tab_bal = st.tabs(["INCOME STATEMENT (ANNUAL SEC FILINGS)", "BALANCE SHEET (ANNUAL SEC FILINGS)"])

    with tab_inc:
        st.dataframe(filings_data["income_statement"], use_container_width=True, height=240)

    with tab_bal:
        st.dataframe(filings_data["balance_sheet"], use_container_width=True, height=240)

# -----------------------------------------------------------------------------
# PANE 5: World Interest Rates & Fixed Income Terminal (WIRP/FI)
# -----------------------------------------------------------------------------
if focus_mode in ["ALL PANES (Multi-Grid)", "PANE 5"]:
    st.markdown(f'<div class="terminal-pane {"terminal-pane-active" if focus_mode=="PANE 5" else ""}"><div class="terminal-pane-header"><span>[PANE 5 / TAB] WORLD INTEREST RATES & FIXED INCOME (WIRP/FI)</span><span style="color:#00E5FF;">GLOBAL CENTRAL BANKS & BOND YIELDS</span></div></div>', unsafe_allow_html=True)

    fi_col1, fi_col2 = st.columns([1.4, 1])

    with fi_col1:
        st.markdown("##### CENTRAL BANK POLICY RATES & BENCHMARK 10Y SOVEREIGN YIELDS")
        df_wirp = data_engine.get_world_interest_rates()
        st.dataframe(df_wirp, use_container_width=True, height=220)

    with fi_col2:
        st.markdown("##### U.S. TREASURY YIELD CURVE STRUCTURE")
        df_curve = data_engine.get_yield_curve_data()
        fig_curve = go.Figure()
        fig_curve.add_trace(go.Scatter(
            x=df_curve["Maturity"],
            y=df_curve["Yield (%)"],
            mode='lines+markers',
            name='Yield Curve',
            line=dict(color='#00E5FF', width=2),
            marker=dict(size=8, color='#FFB000')
        ))
        fig_curve.update_layout(
            template="plotly_dark",
            paper_bgcolor="#000000",
            plot_bgcolor="#050505",
            font=dict(family="Share Tech Mono, monospace", color="#FFB000"),
            height=220,
            margin=dict(l=10, r=10, t=10, b=10)
        )
        fig_curve.update_xaxes(gridcolor="#221500")
        fig_curve.update_yaxes(gridcolor="#221500")
        st.plotly_chart(fig_curve, use_container_width=True)

    st.markdown("##### GLOBAL FIXED INCOME & CREDIT BOND ETFS")
    df_etfs = data_engine.get_fixed_income_etfs()
    st.dataframe(df_etfs, use_container_width=True, height=180)

# Footer
st.markdown('<div style="text-align: center; color: #8A8D9B; font-size: 11px; margin-top: 15px; border-top: 1px solid #332200; padding-top: 8px;">BLOOMBERG TERMINAL SINGLE-PAGE DASHBOARD | PITCH-BLACK DARK MODE | PRESS ESC OR TYPE COMMAND &lt;GO&gt;</div>', unsafe_allow_html=True)
