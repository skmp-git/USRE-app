def classify_yield_curve_regime(short_rate_change_bps: float, long_rate_change_bps: float) -> dict:
    """
    Classifies macro yield curve regime based on 2-Year (short end) vs 10-Year (long end) yield velocity in bps.

    Classification Matrix:
    - Bull Steepener: Yields fall, 2Y falls faster than 10Y
    - Bear Steepener: Yields rise, 10Y rises faster than 2Y
    - Bull Flattener: Yields fall, 10Y falls faster than 2Y
    - Bear Flattener: Yields rise, 2Y rises faster than 10Y
    - Steepener Twist: Short end falls while Long end rises
    - Flattener Twist: Short end rises while Long end falls
    """
    spread_change = long_rate_change_bps - short_rate_change_bps

    # Twist regimes (opposite directions)
    if short_rate_change_bps < 0 and long_rate_change_bps > 0:
        return {
            "regime": "Steepener Twist",
            "color": "#10B981",
            "badge_bg": "rgba(16, 185, 129, 0.15)",
            "description": "Short end yields fall while Long end yields rise.",
        }
    if short_rate_change_bps > 0 and long_rate_change_bps < 0:
        return {
            "regime": "Flattener Twist",
            "color": "#EF4444",
            "badge_bg": "rgba(239, 68, 68, 0.15)",
            "description": "Short end yields rise while Long end yields fall.",
        }

    # Parallel or directional shifts
    if short_rate_change_bps <= 0 and long_rate_change_bps <= 0:
        # Bull regimes (Yields overall falling)
        if abs(short_rate_change_bps) >= abs(long_rate_change_bps):
            return {
                "regime": "Bull Steepener",
                "color": "#10B981",
                "badge_bg": "rgba(16, 185, 129, 0.15)",
                "description": "Yields fall across the curve; 2Y falls faster than 10Y (steepening amidst rallies).",
            }
        else:
            return {
                "regime": "Bull Flattener",
                "color": "#3B82F6",
                "badge_bg": "rgba(59, 130, 246, 0.15)",
                "description": "Yields fall across the curve; 10Y falls faster than 2Y (flattening amidst rallies).",
            }
    else:
        # Bear regimes (Yields overall rising)
        if long_rate_change_bps >= short_rate_change_bps:
            return {
                "regime": "Bear Steepener",
                "color": "#F59E0B",
                "badge_bg": "rgba(245, 158, 11, 0.15)",
                "description": "Yields rise across the curve; 10Y rises faster than 2Y (steepening amidst sell-offs).",
            }
        else:
            return {
                "regime": "Bear Flattener",
                "color": "#EF4444",
                "badge_bg": "rgba(239, 68, 68, 0.15)",
                "description": "Yields rise across the curve; 2Y rises faster than 10Y (flattening amidst sell-offs).",
            }
