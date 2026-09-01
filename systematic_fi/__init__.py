"""
Systematic Fixed Income Asset Allocation & Signal Generation Engine.
"""

from systematic_fi.data import FREDDataIngestor, DataPreprocessor
from systematic_fi.signals import SignalEngine
from systematic_fi.transformation import SignalTransformer
from systematic_fi.risk import YieldCurveRiskManager
from systematic_fi.rebalancing import RebalanceEngine

__all__ = [
    "FREDDataIngestor",
    "DataPreprocessor",
    "SignalEngine",
    "SignalTransformer",
    "YieldCurveRiskManager",
    "RebalanceEngine",
]
