import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime

import data_engine

# -----------------------------------------------------------------------------
# Page Configuration & Styles
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="BLOOMBERG TERMINAL",
    page_icon="📈",
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
if "current_ticker" not in st.session_state:
    st.session_state.current_ticker = "AAPL"
if "current_view" not in st.session_state:
    st.session_state.current_view = "GP"  # Default to Chart
if "portfolio" not in st.session_state:
    st.session_state.portfolio = [
        {"ticker": "AAPL", "shares": 100, "buy_price": 180.00},
        {"ticker": "NVDA", "shares": 50, "buy_price": 110.00},
        {"ticker": "MSFT", "shares": 40, "buy_price": 400.00}
    ]

# -----------------------------------------------------------------------------
# Header Component: Bloomberg Status & Command Line Bar
# -----------------------------------------------------------------------------
st.markdown("""
<div class="bb-status-bar">
    <div>
        <span class="bb-status-logo">BLOOMBERG</span>
        <span style="margin-left:15px; color:#8a8d9b;">TERMINAL v4.2 | PROFESSIONAL MARKET TERMINAL</span>
    </div>
    <div>
        <span class="bb-live-indicator"></span><span style="color:#00e676; font-weight:bold;">LIVE CONNECTED</span>
        <span style="margin-left:20px; color:#ffaa00;">{}</span>
    </div>
</div>
""".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")), unsafe_allow_html=True)

# Function Key Navigation Shortcuts
func_cols = st.columns(8)
func_keys = [
    ("F1: HELP", "HELP"),
    ("F2: GP (CHART)", "GP"),
    ("F3: DES (INFO)", "DES"),
    ("F4: FA (FIN)", "FA"),
    ("F5: WEI (INDEX)", "WEI"),
    ("F6: TOP (NEWS)", "TOP"),
    ("F7: PORTFOLIO", "PORT"),
    ("F8: MOST (MOVERS)", "MOST")
]

for idx, (label, view_code) in enumerate(func_keys):
    if func_cols[idx].button(label, key=f"fkey_{view_code}"):
        st.session_state.current_view = view_code

# Command Bar Input
st.markdown('<div style="margin-top:5px; margin-bottom:5px;"></div>', unsafe_allow_html=True)
cmd_col1, cmd_col2 = st.columns([4, 1])

with cmd_col1:
    cmd_input = st.text_input(
        "COMMAND PROMPT",
        value=f"{st.session_state.current_ticker} Equity {st.session_state.current_view}",
        key="cmd_bar_input",
        placeholder="Enter Ticker or Command (e.g. AAPL, WEI, TOP, MOST, ECO, PORT) <GO>"
    )

with cmd_col2:
    if st.button("EXECUTE <GO>", key="exec_cmd"):
        parsed = cmd_input.strip().upper().split()
        if len(parsed) > 0:
            first_token = parsed[0]
            # Check if first token is a view command
            if first_token in ["HELP", "GP", "DES", "FA", "WEI", "TOP", "PORT", "MOST", "ECO"]:
                st.session_state.current_view = first_token
            else:
                st.session_state.current_ticker = first_token
                if len(parsed) > 1 and parsed[1] in ["GP", "DES", "FA", "TOP", "HELP"]:
                    st.session_state.current_view = parsed[1]

ticker = st.session_state.current_ticker
view = st.session_state.current_view

# Ticker Header Strip
info = data_engine.get_stock_info(ticker)
price_cls = "ticker-up" if info["change"] >= 0 else "ticker-down"
sign = "+" if info["change"] >= 0 else ""

st.markdown(f"""
<div class="bb-panel" style="padding: 8px 15px; background-color: #12141a; border-left: 4px solid #ff9900;">
    <span style="font-size: 20px; font-weight: bold; color: #ffaa00;">{info['symbol']}</span>
    <span style="color: #ffffff; font-size: 16px; margin-left: 10px;">{info['longName']}</span>
    <span style="color: #8a8d9b; font-size: 13px; margin-left: 10px;">| {info['sector']} - {info['industry']} | CURRENCY: {info['currency']}</span>
    <div style="float: right; font-size: 18px;">
        <span style="color: #ffffff; font-weight: bold;">${info['currentPrice']:.2f}</span>
        <span class="{price_cls}" style="margin-left: 10px;">{sign}{info['change']:.2f} ({sign}{info['pctChange']:.2f}%)</span>
    </div>
</div>
""", unsafe_allow_html=True)


# -----------------------------------------------------------------------------
# Views Logic
# -----------------------------------------------------------------------------

# VIEW: GP (Graph Plot / Interactive Technical Charting)
if view == "GP":
    st.markdown('<div class="bb-panel-header">F2: GP - GRAPH PLOT & TECHNICAL ANALYSIS</div>', unsafe_allow_html=True)

    ctrl_col1, ctrl_col2, ctrl_col3, ctrl_col4 = st.columns(4)
    with ctrl_col1:
        time_period = st.selectbox("Period", ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"], index=3)
    with ctrl_col2:
        chart_type = st.selectbox("Chart Type", ["Candlestick", "Line"], index=0)
    with ctrl_col3:
        indicators = st.multiselect("Overlay Indicators", ["SMA 20", "SMA 50", "SMA 200", "Bollinger Bands"], default=["SMA 20", "SMA 50"])
    with ctrl_col4:
        sub_indicator = st.selectbox("Sub-Chart", ["Volume & RSI", "Volume & MACD"], index=0)

    df_hist = data_engine.get_historical_data(ticker, period=time_period)

    if not df_hist.empty:
        # Create Plotly figure with subplots
        fig = make_subplots(
            rows=3, cols=1,
            shared_xaxes=True,
            vertical_spacing=0.03,
            subplot_titles=(f"{ticker} PRICE ACTION ({time_period.upper()})", "VOLUME", sub_indicator),
            row_heights=[0.6, 0.2, 0.2]
        )

        # Price Plot
        if chart_type == "Candlestick":
            fig.add_trace(go.Candlestick(
                x=df_hist.index,
                open=df_hist['Open'],
                high=df_hist['High'],
                low=df_hist['Low'],
                close=df_hist['Close'],
                name="OHLC",
                increasing_line_color='#00e676',
                decreasing_line_color='#ff5252'
            ), row=1, col=1)
        else:
            fig.add_trace(go.Scatter(
                x=df_hist.index, y=df_hist['Close'],
                mode='lines', name='Close Price',
                line=dict(color='#ffaa00', width=2)
            ), row=1, col=1)

        # Moving Averages Overlay
        if "SMA 20" in indicators and 'SMA_20' in df_hist:
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['SMA_20'], line=dict(color='#00e5ff', width=1.5), name='SMA 20'), row=1, col=1)
        if "SMA 50" in indicators and 'SMA_50' in df_hist:
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['SMA_50'], line=dict(color='#e040fb', width=1.5), name='SMA 50'), row=1, col=1)
        if "SMA 200" in indicators and 'SMA_200' in df_hist:
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['SMA_200'], line=dict(color='#ff9100', width=1.5), name='SMA 200'), row=1, col=1)

        # Bollinger Bands
        if "Bollinger Bands" in indicators and 'BB_Upper' in df_hist:
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['BB_Upper'], line=dict(color='#78909c', width=1, dash='dash'), name='BB Upper'), row=1, col=1)
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['BB_Lower'], line=dict(color='#78909c', width=1, dash='dash'), fill='tonexty', fillcolor='rgba(120,144,156,0.1)', name='BB Lower'), row=1, col=1)

        # Volume Subplot
        colors = ['#00e676' if row['Close'] >= row['Open'] else '#ff5252' for _, row in df_hist.iterrows()]
        fig.add_trace(go.Bar(
            x=df_hist.index, y=df_hist['Volume'],
            marker_color=colors, name="Volume", showlegend=False
        ), row=2, col=1)

        # Sub-Indicator (RSI or MACD)
        if sub_indicator == "Volume & RSI":
            fig.add_trace(go.Scatter(
                x=df_hist.index, y=df_hist['RSI_14'],
                line=dict(color='#ffab00', width=1.5), name="RSI (14)"
            ), row=3, col=1)
            # Add RSI Overbought/Oversold lines
            fig.add_hline(y=70, line_dash="dash", line_color="#ff5252", row=3, col=1)
            fig.add_hline(y=30, line_dash="dash", line_color="#00e676", row=3, col=1)
        else: # MACD
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['MACD'], line=dict(color='#00e5ff', width=1.5), name="MACD"), row=3, col=1)
            fig.add_trace(go.Scatter(x=df_hist.index, y=df_hist['MACD_Signal'], line=dict(color='#ff4081', width=1.5), name="Signal"), row=3, col=1)
            fig.add_trace(go.Bar(x=df_hist.index, y=df_hist['MACD_Hist'], name="Histogram"), row=3, col=1)

        # Terminal Plotly Layout Styling
        fig.update_layout(
            template="plotly_dark",
            paper_bgcolor="#0d0e11",
            plot_bgcolor="#14161d",
            font=dict(family="Share Tech Mono, monospace", color="#ffaa00"),
            height=650,
            margin=dict(l=10, r=10, t=30, b=10),
            xaxis_rangeslider_visible=False,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        fig.update_xaxes(gridcolor="#2a2d3d")
        fig.update_yaxes(gridcolor="#2a2d3d")

        st.plotly_chart(fig, use_container_width=True)

# VIEW: DES (Security Description & Key Metrics)
elif view == "DES":
    st.markdown('<div class="bb-panel-header">F3: DES - SECURITY DESCRIPTION & KEY STATISTICS</div>', unsafe_allow_html=True)

    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown(f"### COMPANY PROFILE")
        st.write(info.get("summary", "No description available."))

        st.markdown("---")
        st.markdown("### KEY FINANCIAL METRICS")
        m_col1, m_col2, m_col3 = st.columns(3)

        m_col1.metric("MARKET CAP", f"${info['marketCap']:,.0f}" if isinstance(info['marketCap'], (int, float)) else info['marketCap'])
        m_col1.metric("TRAILING P/E", f"{info['peRatio']:.2f}" if isinstance(info['peRatio'], (int, float)) else info['peRatio'])
        m_col1.metric("FORWARD P/E", f"{info['forwardPE']:.2f}" if isinstance(info['forwardPE'], (int, float)) else info['forwardPE'])

        m_col2.metric("52-WEEK HIGH", f"${info['fiftyTwoWeekHigh']:.2f}" if isinstance(info['fiftyTwoWeekHigh'], (int, float)) else info['fiftyTwoWeekHigh'])
        m_col2.metric("52-WEEK LOW", f"${info['fiftyTwoWeekLow']:.2f}" if isinstance(info['fiftyTwoWeekLow'], (int, float)) else info['fiftyTwoWeekLow'])
        m_col2.metric("PEG RATIO", f"{info['pegRatio']:.2f}" if isinstance(info['pegRatio'], (int, float)) else info['pegRatio'])

        m_col3.metric("50-DAY AVG", f"${info['fiftyDayAverage']:.2f}" if isinstance(info['fiftyDayAverage'], (int, float)) else info['fiftyDayAverage'])
        m_col3.metric("200-DAY AVG", f"${info['twoHundredDayAverage']:.2f}" if isinstance(info['twoHundredDayAverage'], (int, float)) else info['twoHundredDayAverage'])
        m_col3.metric("DIV YIELD", f"{info['dividendYield']*100:.2f}%" if isinstance(info['dividendYield'], (int, float)) else "0.00%")

    with col2:
        st.markdown("### TRADING SUMMARY")
        summary_table = pd.DataFrame([
            {"Metric": "Open", "Value": f"${info['open']:.2f}"},
            {"Metric": "Day High", "Value": f"${info['dayHigh']:.2f}"},
            {"Metric": "Day Low", "Value": f"${info['dayLow']:.2f}"},
            {"Metric": "Previous Close", "Value": f"${info['previousClose']:.2f}"},
            {"Metric": "Volume", "Value": f"{info['volume']:,}"},
            {"Metric": "Avg Volume", "Value": f"{info['avgVolume']:,}"},
            {"Metric": "Currency", "Value": info['currency']}
        ])
        st.table(summary_table)

# VIEW: FA (Financial Analysis)
elif view == "FA":
    st.markdown('<div class="bb-panel-header">F4: FA - FINANCIAL ANALYSIS STATEMENTS</div>', unsafe_allow_html=True)

    fin_data = data_engine.get_financials(ticker)
    tab1, tab2, tab3 = st.tabs(["INCOME STATEMENT", "BALANCE SHEET", "CASH FLOW"])

    with tab1:
        if not fin_data["income"].empty:
            st.dataframe(fin_data["income"], use_container_width=True)
        else:
            st.info("Income statement data not available for this ticker.")

    with tab2:
        if not fin_data["balance"].empty:
            st.dataframe(fin_data["balance"], use_container_width=True)
        else:
            st.info("Balance sheet data not available for this ticker.")

    with tab3:
        if not fin_data["cashflow"].empty:
            st.dataframe(fin_data["cashflow"], use_container_width=True)
        else:
            st.info("Cash flow statement data not available for this ticker.")

# VIEW: WEI (World Equity Indices)
elif view == "WEI":
    st.markdown('<div class="bb-panel-header">F5: WEI - WORLD EQUITY INDICES & MARKETS OVERVIEW</div>', unsafe_allow_html=True)

    indices = data_engine.get_world_indices()
    df_wei = pd.DataFrame(indices)

    if not df_wei.empty:
        # Style dataframe table columns
        st.dataframe(
            df_wei.style.map(
                lambda val: 'color: #00e676; font-weight: bold;' if val > 0 else ('color: #ff5252; font-weight: bold;' if val < 0 else ''),
                subset=['Change', 'PctChange']
            ),
            use_container_width=True,
            height=450
        )

# VIEW: TOP (Market News)
elif view == "TOP":
    st.markdown(f'<div class="bb-panel-header">F6: TOP - MARKET NEWS FEED ({ticker})</div>', unsafe_allow_html=True)

    news_items = data_engine.get_news(ticker)
    for news in news_items:
        st.markdown(f"""
        <div class="bb-panel">
            <div style="color: #ffaa00; font-weight: bold; font-size: 15px;">
                <a href="{news['link']}" target="_blank" style="color: #ffaa00; text-decoration: none;">{news['title']}</a>
            </div>
            <div style="color: #8a8d9b; font-size: 12px; margin-top: 5px;">
                <span>{news['publisher']}</span> | <span>{news['time']}</span>
            </div>
        </div>
        """, unsafe_allow_html=True)

# VIEW: PORT (Portfolio Monitor)
elif view == "PORT":
    st.markdown('<div class="bb-panel-header">F7: PORT - PORTFOLIO MANAGER & P&L MONITOR</div>', unsafe_allow_html=True)

    # Portfolio Controls
    st.markdown("##### ADD POSITION")
    add_col1, add_col2, add_col3, add_col4 = st.columns(4)
    with add_col1:
        new_ticker = st.text_input("Ticker", value="GOOGL", key="port_add_ticker")
    with add_col2:
        new_shares = st.number_input("Shares", min_value=1, value=10, key="port_add_shares")
    with add_col3:
        new_price = st.number_input("Buy Price ($)", min_value=0.01, value=150.0, key="port_add_price")
    with add_col4:
        st.markdown('<div style="margin-top:28px;"></div>', unsafe_allow_html=True)
        if st.button("ADD POSITION", key="btn_add_pos"):
            st.session_state.portfolio.append({"ticker": new_ticker.upper(), "shares": new_shares, "buy_price": new_price})
            st.success(f"Added {new_shares} shares of {new_ticker.upper()}")

    # Calculate Portfolio P&L
    port_rows = []
    total_val = 0.0
    total_cost = 0.0

    for pos in st.session_state.portfolio:
        s_info = data_engine.get_stock_info(pos["ticker"])
        cur_p = s_info["currentPrice"]
        mkt_val = pos["shares"] * cur_p
        cost_basis = pos["shares"] * pos["buy_price"]
        pnl = mkt_val - cost_basis
        pnl_pct = (pnl / cost_basis * 100) if cost_basis else 0.0

        total_val += mkt_val
        total_cost += cost_basis

        port_rows.append({
            "Ticker": pos["ticker"],
            "Shares": pos["shares"],
            "Buy Price": f"${pos['buy_price']:.2f}",
            "Current Price": f"${cur_p:.2f}",
            "Market Value": f"${mkt_val:,.2f}",
            "P&L ($)": pnl,
            "P&L (%)": pnl_pct
        })

    tot_pnl = total_val - total_cost
    tot_pnl_pct = (tot_pnl / total_cost * 100) if total_cost else 0.0

    st.markdown("---")
    st.markdown("##### PORTFOLIO SUMMARY")
    sum_c1, sum_c2, sum_c3, sum_c4 = st.columns(4)
    sum_c1.metric("TOTAL PORTFOLIO VALUE", f"${total_val:,.2f}")
    sum_c2.metric("TOTAL COST BASIS", f"${total_cost:,.2f}")
    sum_c3.metric("UNREALIZED P&L ($)", f"${tot_pnl:,.2f}", delta=f"{tot_pnl:,.2f}")
    sum_c4.metric("UNREALIZED P&L (%)", f"{tot_pnl_pct:.2f}%", delta=f"{tot_pnl_pct:.2f}%")

    df_port = pd.DataFrame(port_rows)
    if not df_port.empty:
        st.dataframe(
            df_port.style.map(
                lambda val: 'color: #00e676; font-weight: bold;' if val > 0 else ('color: #ff5252; font-weight: bold;' if val < 0 else ''),
                subset=['P&L ($)', 'P&L (%)']
            ),
            use_container_width=True
        )

# VIEW: MOST (Market Movers)
elif view == "MOST":
    st.markdown('<div class="bb-panel-header">F8: MOST - MARKET MOVERS & MOST ACTIVE</div>', unsafe_allow_html=True)

    movers = data_engine.get_market_movers()

    col_g, col_l, col_a = st.columns(3)

    with col_g:
        st.markdown("### TOP GAINERS")
        st.dataframe(movers["gainers"], use_container_width=True)

    with col_l:
        st.markdown("### TOP LOSERS")
        st.dataframe(movers["losers"], use_container_width=True)

    with col_a:
        st.markdown("### MOST ACTIVE")
        st.dataframe(movers["most_active"], use_container_width=True)

# VIEW: ECO (Macroeconomic Indicators)
elif view == "ECO":
    st.markdown('<div class="bb-panel-header">ECO - MACROECONOMIC INDICATORS & RATES</div>', unsafe_allow_html=True)

    df_macro = data_engine.get_macro_economic_data()
    st.dataframe(df_macro, use_container_width=True)

# VIEW: HELP (Documentation & Command List)
elif view == "HELP":
    st.markdown('<div class="bb-panel-header">F1: HELP - TERMINAL USER GUIDE & COMMAND DIRECTORY</div>', unsafe_allow_html=True)

    st.markdown("""
    ### BLOOMBERG TERMINAL COMMAND QUICK REFERENCE

    Use the top function keys or type the following commands into the prompt bar above followed by **<GO>**:

    - **`<TICKER> GP`** : Interactive Technical Price Chart & Indicators (e.g. `AAPL GP`, `TSLA GP`, `NVDA GP`).
    - **`<TICKER> DES`**: Company Overview, Profile, and Key Ratios.
    - **`<TICKER> FA`** : Financial Statements (Income, Balance Sheet, Cash Flow).
    - **`<TICKER> TOP`**: Live News Feed related to specified symbol.
    - **`WEI`**        : World Equity Indices, Forex, Crypto & Commodities.
    - **`PORT`**       : Portfolio P&L Monitor & Position Manager.
    - **`MOST`**       : Top Market Gainers, Losers, and Volume Active Equities.
    - **`ECO`**        : Macroeconomic Indicators & Federal Interest Rates.

    ---
    *System Version: 4.2.0 | Local Desktop Deployment Ready*
    """)

# Footer
st.markdown("""
<div style="text-align: center; color: #8a8d9b; font-size: 11px; margin-top: 30px; border-top: 1px solid #2a2d3d; padding-top: 10px;">
    BLOOMBERG TERMINAL SIMULATOR | LOCAL DESKTOP EDITION | PRESS FUNCTION KEYS OR COMMAND BAR TO NAVIGATE
</div>
""", unsafe_allow_html=True)
