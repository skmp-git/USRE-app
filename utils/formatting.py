import plotly.graph_objects as go


def format_return_html(val):
    """Formats numeric return values with color coding (emerald for positive, crimson for negative)."""
    if val is None:
        return "<span style='color:#6B7280;'>N/A</span>"
    color = "#059669" if val > 0 else ("#DC2626" if val < 0 else "#4B5563")
    sign = "+" if val > 0 else ""
    return f"<span style='color:{color}; font-weight: 600;'>{sign}{val:.2f}%</span>"


def render_sparkline_fig(prices):
    """Generates a small interactive Plotly figure for sparkline rendering in Streamlit."""
    if not prices or len(prices) < 2:
        fig = go.Figure()
        fig.update_layout(
            height=30,
            width=120,
            margin=dict(l=0, r=0, t=0, b=0),
            paper_bgcolor="rgba(0,0,0,0)",
            plot_bgcolor="rgba(0,0,0,0)",
        )
        return fig

    line_color = "#059669" if prices[-1] >= prices[0] else "#DC2626"
    fig = go.Figure(
        data=go.Scatter(
            x=list(range(len(prices))),
            y=prices,
            mode="lines",
            line=dict(color=line_color, width=2.2),
            hoverinfo="y",
        )
    )
    fig.update_layout(
        height=35,
        width=130,
        margin=dict(l=2, r=2, t=2, b=2),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
    )
    return fig
