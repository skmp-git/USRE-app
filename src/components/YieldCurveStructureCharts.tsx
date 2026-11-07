/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Currency,
  YieldCurvePoint,
  PositionValuation,
  KeyRateDurationPoint,
  PortfolioValuationResult,
} from '../types/portfolio';
import {
  Activity,
  TrendingUp,
  BarChart2,
  Sliders,
  Maximize2,
  Layers,
  ArrowRight,
  Info,
  ChevronRight,
  Zap,
  Check,
} from 'lucide-react';

interface YieldCurveStructureChartsProps {
  analytics: PortfolioValuationResult;
  yieldCurves: YieldCurvePoint[];
  baseCurrency: Currency;
  onSelectIsin?: (isin: string) => void;
}

// Tenor mapping to years
const TENOR_YEARS: Record<string, number> = {
  '1M': 1 / 12,
  '3M': 3 / 12,
  '6M': 6 / 12,
  '1Y': 1,
  '2Y': 2,
  '3Y': 3,
  '5Y': 5,
  '7Y': 7,
  '10Y': 10,
  '20Y': 20,
  '30Y': 30,
};

type ChartTab = 'curves' | 'krd' | 'scenarios';

type ScenarioType = 'base' | 'parallel_up' | 'parallel_down' | 'steepener' | 'flattener' | 'inversion';

export const YieldCurveStructureCharts: React.FC<YieldCurveStructureChartsProps> = ({
  analytics,
  yieldCurves,
  baseCurrency,
  onSelectIsin,
}) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('curves');
  const [showUst, setShowUst] = useState<boolean>(true);
  const [showSofr, setShowSofr] = useState<boolean>(true);
  const [showEuribor, setShowEuribor] = useState<boolean>(true);
  const [showHoldings, setShowHoldings] = useState<boolean>(true);
  const [showTentOverlay, setShowTentOverlay] = useState<boolean>(true);
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('base');
  const [scaleType, setScaleType] = useState<'curve' | 'linear'>('curve');
  const [hoveredPoint, setHoveredPoint] = useState<{
    type: 'holding' | 'curve' | 'krd';
    title: string;
    subtitle: string;
    xVal: number;
    yVal: number;
    details: { label: string; value: string; color?: string }[];
  } | null>(null);

  // Group yield curves by curveId
  const curvesMap = useMemo(() => {
    const map: Record<string, { tenor: string; years: number; rate: number }[]> = {
      UST: [],
      SOFR: [],
      EURIBOR: [],
    };

    for (const pt of yieldCurves) {
      const yrs = TENOR_YEARS[pt.tenor];
      if (yrs !== undefined && map[pt.curveId]) {
        map[pt.curveId].push({
          tenor: pt.tenor,
          years: yrs,
          rate: pt.rate,
        });
      }
    }

    // Sort by tenor years
    for (const id in map) {
      map[id].sort((a, b) => a.years - b.years);
    }
    return map;
  }, [yieldCurves]);

  // Helper to interpolate UST yield at arbitrary tenor years
  const getUstYieldAt = (years: number): number => {
    const pts = curvesMap.UST;
    if (pts.length === 0) return 0.042;
    if (years <= pts[0].years) return pts[0].rate;
    if (years >= pts[pts.length - 1].years) return pts[pts.length - 1].rate;

    for (let i = 0; i < pts.length - 1; i++) {
      if (years >= pts[i].years && years <= pts[i + 1].years) {
        const ratio = (years - pts[i].years) / (pts[i + 1].years - pts[i].years);
        return pts[i].rate + ratio * (pts[i + 1].rate - pts[i].rate);
      }
    }
    return 0.042;
  };

  // 1. Curve slope metrics (2s10s, 3M10s, 5s30s)
  const slopeMetrics = useMemo(() => {
    const ust = curvesMap.UST;
    const findRate = (t: string) => ust.find((p) => p.tenor === t)?.rate;

    const r3m = findRate('3M') || 0.0475;
    const r2y = findRate('2Y') || 0.0415;
    const r5y = findRate('5Y') || 0.0405;
    const r10y = findRate('10Y') || 0.0428;
    const r30y = findRate('30Y') || 0.0452;

    const spread2s10s = (r10y - r2y) * 10000;
    const spread3m10s = (r10y - r3m) * 10000;
    const spread5s30s = (r30y - r5y) * 10000;

    return {
      r10y: r10y * 100,
      r2y: r2y * 100,
      spread2s10s,
      spread3m10s,
      spread5s30s,
    };
  }, [curvesMap]);

  // 2. Active Bond Holdings mapped for scatter plot (Maturity vs. YTM)
  const holdingsPoints = useMemo(() => {
    const valDate = new Date(analytics.asOfDate);
    return analytics.positions
      .filter((p) => p.quantity > 0 && p.ytm > 0 && p.instrument.assetClass !== 'MutualFund')
      .map((pos) => {
        let matDateStr = '2030-01-01';
        if ('maturityDate' in pos.instrument && pos.instrument.maturityDate) {
          matDateStr = pos.instrument.maturityDate;
        } else if ('expiryDate' in pos.instrument && pos.instrument.expiryDate) {
          matDateStr = pos.instrument.expiryDate;
        }

        const matDate = new Date(matDateStr);
        const diffMs = matDate.getTime() - valDate.getTime();
        const years = Math.max(0.1, diffMs / (1000 * 60 * 60 * 24 * 365.25));
        const ytmPct = pos.ytm * 100;
        const benchmarkUstYield = getUstYieldAt(years) * 100;
        const spreadBps = Math.round((ytmPct - benchmarkUstYield) * 100);

        return {
          isin: pos.isin,
          name: pos.instrument.name,
          assetClass: pos.instrument.assetClass,
          currency: pos.instrument.currency,
          rating: pos.instrument.creditRating || 'NR',
          years,
          ytmPct,
          benchmarkUstYield,
          spreadBps,
          marketValue: pos.marketValueBase,
          duration: pos.modifiedDuration,
          weight: pos.portfolioWeight,
        };
      });
  }, [analytics, curvesMap]);

  // Average spread over UST
  const avgPortfolioSpread = useMemo(() => {
    const totalMv = holdingsPoints.reduce((sum, h) => sum + h.marketValue, 0);
    if (totalMv === 0) return 0;
    const weightedSpread = holdingsPoints.reduce((sum, h) => sum + h.spreadBps * h.marketValue, 0);
    return Math.round(weightedSpread / totalMv);
  }, [holdingsPoints]);

  // Coordinate scales for SVG canvas
  const svgWidth = 840;
  const svgHeight = 340;
  const padLeft = 55;
  const padRight = 35;
  const padTop = 25;
  const padBottom = 45;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxYears = 30;
  const minRatePct = 1.5;
  const maxRatePct = 7.5;

  // X coordinate mapper
  const getX = (years: number) => {
    const clamped = Math.max(0.05, Math.min(maxYears, years));
    if (scaleType === 'linear') {
      return padLeft + (clamped / maxYears) * chartW;
    }
    // Curve / Square-root scale gives realistic financial spacing to 3M-2Y short end
    const norm = Math.sqrt(clamped) / Math.sqrt(maxYears);
    return padLeft + norm * chartW;
  };

  // Y coordinate mapper
  const getY = (ratePct: number) => {
    const clamped = Math.max(minRatePct, Math.min(maxRatePct, ratePct));
    return padTop + chartH - ((clamped - minRatePct) / (maxRatePct - minRatePct)) * chartH;
  };

  // Generate SVG path for a curve
  const generateCurvePath = (pts: { years: number; rate: number }[], shiftBps: number = 0) => {
    if (pts.length === 0) return '';
    const points = pts.map((p) => ({
      x: getX(p.years),
      y: getY(p.rate * 100 + shiftBps / 100),
    }));

    // Smooth path using tension
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };

  // Scenario Curve Generator
  const getScenarioShiftForYear = (scenario: ScenarioType, years: number): number => {
    switch (scenario) {
      case 'parallel_up':
        return 50;
      case 'parallel_down':
        return -50;
      case 'steepener': {
        // -30bp on short end to +30bp on 30Y
        const norm = Math.min(1, Math.max(0, years / 30));
        return -30 + norm * 60;
      }
      case 'flattener': {
        // +50bp on 2Y, +10bp on 30Y
        const norm = Math.min(1, Math.max(0, years / 30));
        return 50 - norm * 40;
      }
      case 'inversion': {
        // +75bp on 2Y, -25bp on 10Y/30Y
        if (years <= 2) return 75;
        if (years <= 10) return 75 - ((years - 2) / 8) * 100;
        return -25;
      }
      default:
        return 0;
    }
  };

  // Estimated portfolio impact under scenario
  const scenarioImpact = useMemo(() => {
    if (activeScenario === 'base') {
      return { pnl: 0, pct: 0, label: 'Base Market Portfolio Valuation' };
    }

    let totalDollarImpact = 0;
    for (const krd of analytics.keyRateDurations) {
      const shiftBps = getScenarioShiftForYear(activeScenario, krd.years);
      // P&L impact = -DV01 * shiftBps
      totalDollarImpact -= krd.dv01 * shiftBps;
    }

    const pctImpact =
      analytics.totalHoldingsValue > 0
        ? (totalDollarImpact / analytics.totalHoldingsValue) * 100
        : 0;

    let label = '';
    if (activeScenario === 'parallel_up') label = '+50 bps Parallel Bear Shock';
    else if (activeScenario === 'parallel_down') label = '-50 bps Parallel Bull Rally';
    else if (activeScenario === 'steepener') label = 'Bull Steepener (-30bp Short / +30bp Long)';
    else if (activeScenario === 'flattener') label = 'Bear Flattener (+50bp Short / +10bp Long)';
    else if (activeScenario === 'inversion') label = 'Severe Curve Inversion (+75bp 2Y / -25bp 10Y)';

    return {
      pnl: totalDollarImpact,
      pct: pctImpact,
      label,
    };
  }, [activeScenario, analytics]);

  // Major ticks for X Axis
  const xTicks = [
    { label: '3M', years: 0.25 },
    { label: '6M', years: 0.5 },
    { label: '1Y', years: 1 },
    { label: '2Y', years: 2 },
    { label: '3Y', years: 3 },
    { label: '5Y', years: 5 },
    { label: '7Y', years: 7 },
    { label: '10Y', years: 10 },
    { label: '20Y', years: 20 },
    { label: '30Y', years: 30 },
  ];

  // Major ticks for Y Axis (every 1.0%)
  const yTicks = [2.0, 3.0, 4.0, 5.0, 6.0, 7.0];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
      {/* 1. Header Bar: Title, Sub-Tab Switcher & Slope Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <div>
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
              Yield Curve Term Structure &amp; Key Rate Durations
            </h3>
            <p className="text-[11px] text-slate-400">
              Interactive benchmark curves, portfolio holdings relative value scatter, and 9 Key Rate Durations (KRD).
            </p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('curves')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'curves'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Yield Curves &amp; Holdings</span>
          </button>
          <button
            onClick={() => setActiveTab('krd')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'krd'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>9 Key Rate Durations</span>
          </button>
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              activeTab === 'scenarios'
                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Curve Shift Scenarios</span>
          </button>
        </div>
      </div>

      {/* 2. Curve Slope & Macro Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
        {/* 10Y Benchmark Rate */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase">UST 10Y Benchmark</span>
          <div className="text-sm font-bold text-cyan-400 tabular-nums mt-0.5">
            {slopeMetrics.r10y.toFixed(2)}%
          </div>
        </div>

        {/* 2s10s Spread */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase">2s10s Spread</span>
            <span
              className={`text-[9px] px-1 rounded ${
                slopeMetrics.spread2s10s >= 0
                  ? 'bg-emerald-950 text-emerald-300'
                  : 'bg-rose-950 text-rose-300'
              }`}
            >
              {slopeMetrics.spread2s10s >= 0 ? 'Normal' : 'Inverted'}
            </span>
          </div>
          <div
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              slopeMetrics.spread2s10s >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {slopeMetrics.spread2s10s >= 0 ? '+' : ''}
            {slopeMetrics.spread2s10s.toFixed(0)} bps
          </div>
        </div>

        {/* 3M10s Spread */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase">3M10s Spread</span>
            <span
              className={`text-[9px] px-1 rounded ${
                slopeMetrics.spread3m10s >= 0
                  ? 'bg-emerald-950 text-emerald-300'
                  : 'bg-rose-950 text-rose-300'
              }`}
            >
              {slopeMetrics.spread3m10s >= 0 ? 'Normal' : 'Inverted'}
            </span>
          </div>
          <div
            className={`text-sm font-bold tabular-nums mt-0.5 ${
              slopeMetrics.spread3m10s >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {slopeMetrics.spread3m10s >= 0 ? '+' : ''}
            {slopeMetrics.spread3m10s.toFixed(0)} bps
          </div>
        </div>

        {/* 5s30s Spread */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase">5s30s Spread</span>
          <div className="text-sm font-bold text-indigo-300 tabular-nums mt-0.5">
            {slopeMetrics.spread5s30s >= 0 ? '+' : ''}
            {slopeMetrics.spread5s30s.toFixed(0)} bps
          </div>
        </div>

        {/* Portfolio Spread Over UST */}
        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80">
          <span className="text-[10px] text-slate-500 uppercase">Portf. Avg Spread</span>
          <div className="text-sm font-bold text-amber-400 tabular-nums mt-0.5">
            +{avgPortfolioSpread} bps <span className="text-[10px] text-slate-500 font-normal">o/ UST</span>
          </div>
        </div>
      </div>

      {/* 3. CHART CONTENT AREA */}
      {activeTab === 'curves' && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono bg-slate-950/60 p-2 rounded border border-slate-800/60">
            {/* Curve Toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300">
                <input
                  type="checkbox"
                  checked={showUst}
                  onChange={(e) => setShowUst(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                />
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" />
                <span>US Treasury (UST)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-emerald-300">
                <input
                  type="checkbox"
                  checked={showSofr}
                  onChange={(e) => setShowSofr(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                />
                <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                <span>SOFR Term</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-amber-300">
                <input
                  type="checkbox"
                  checked={showEuribor}
                  onChange={(e) => setShowEuribor(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500"
                />
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
                <span>EURIBOR / Bund</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-purple-300">
                <input
                  type="checkbox"
                  checked={showHoldings}
                  onChange={(e) => setShowHoldings(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-purple-500"
                />
                <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                <span>Holdings Overlay ({holdingsPoints.length})</span>
              </label>
            </div>

            {/* Scale toggle */}
            <div className="flex items-center gap-2 text-slate-400">
              <span>Term Axis:</span>
              <button
                onClick={() => setScaleType(scaleType === 'curve' ? 'linear' : 'curve')}
                className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded border border-slate-700 text-[10px]"
              >
                {scaleType === 'curve' ? 'Bond Term Scale (√t)' : 'Linear 0-30Y'}
              </button>
            </div>
          </div>

          {/* SVG Canvas Container */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800/90 overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[380px] select-none"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                {/* Gradients */}
                <linearGradient id="ustGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="sofrGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines - Horizontal (Yield %) */}
              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="0.8"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      fill="#64748b"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {tick.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* Grid Lines - Vertical (Tenors) */}
              {xTicks.map((tick) => {
                const x = getX(tick.years);
                return (
                  <g key={tick.label}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + chartH}
                      stroke="#1e293b"
                      strokeWidth="0.8"
                    />
                    <text
                      x={x}
                      y={padTop + chartH + 16}
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {tick.label}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Baseline */}
              <line
                x1={padLeft}
                y1={padTop + chartH}
                x2={svgWidth - padRight}
                y2={padTop + chartH}
                stroke="#475569"
                strokeWidth="1"
              />

              {/* Y Axis Baseline */}
              <line
                x1={padLeft}
                y1={padTop}
                x2={padLeft}
                y2={padTop + chartH}
                stroke="#475569"
                strokeWidth="1"
              />

              {/* Axis Labels */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 10}
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                Maturity / Tenor (Years to Maturity)
              </text>
              <text
                x={15}
                y={svgHeight / 2}
                fill="#64748b"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
                transform={`rotate(-90 15 ${svgHeight / 2})`}
              >
                Yield to Maturity (YTM %)
              </text>

              {/* 1. EURIBOR Curve */}
              {showEuribor && curvesMap.EURIBOR.length > 0 && (
                <path
                  d={generateCurvePath(curvesMap.EURIBOR)}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {/* 2. SOFR Curve */}
              {showSofr && curvesMap.SOFR.length > 0 && (
                <path
                  d={generateCurvePath(curvesMap.SOFR)}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}

              {/* 3. UST Curve Area Fill & Line */}
              {showUst && curvesMap.UST.length > 0 && (
                <>
                  <path
                    d={`${generateCurvePath(curvesMap.UST)} L ${getX(30)} ${padTop + chartH} L ${getX(curvesMap.UST[0].years)} ${padTop + chartH} Z`}
                    fill="url(#ustGlow)"
                  />
                  <path
                    d={generateCurvePath(curvesMap.UST)}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {/* UST Curve Nodes */}
                  {curvesMap.UST.map((p) => {
                    const cx = getX(p.years);
                    const cy = getY(p.rate * 100);
                    return (
                      <circle
                        key={p.tenor}
                        cx={cx}
                        cy={cy}
                        r="3.5"
                        fill="#0891b2"
                        stroke="#22d3ee"
                        strokeWidth="1.5"
                        className="cursor-pointer hover:r-5 transition-all"
                        onMouseEnter={() =>
                          setHoveredPoint({
                            type: 'curve',
                            title: `US Treasury ${p.tenor} Benchmark`,
                            subtitle: `${p.years} Year Benchmark Node`,
                            xVal: cx,
                            yVal: cy,
                            details: [
                              { label: 'Tenor', value: p.tenor },
                              { label: 'Yield', value: `${(p.rate * 100).toFixed(3)}%`, color: 'text-cyan-400' },
                              { label: 'Curve ID', value: 'UST' },
                            ],
                          })
                        }
                      />
                    );
                  })}
                </>
              )}

              {/* 4. Portfolio Holdings Scatter Points */}
              {showHoldings &&
                holdingsPoints.map((h) => {
                  const cx = getX(h.years);
                  const cy = getY(h.ytmPct);
                  // Radius scaled by position market value (4 to 10px)
                  const radius = Math.min(10, Math.max(4.5, 4.5 + Math.sqrt(h.marketValue / 200000)));

                  // Asset class color
                  let fill = '#818cf8';
                  let stroke = '#6366f1';
                  if (h.assetClass === 'DirectBond') {
                    fill = '#38bdf8';
                    stroke = '#0284c7';
                  } else if (h.assetClass === 'CapFloorFloater') {
                    fill = '#34d399';
                    stroke = '#059669';
                  } else if (h.assetClass === 'BondLinkedNote') {
                    fill = '#fbbf24';
                    stroke = '#d97706';
                  } else if (h.assetClass === 'PrivatePlacement') {
                    fill = '#c084fc';
                    stroke = '#9333ea';
                  }

                  return (
                    <g key={h.isin}>
                      {/* Spread stem down to benchmark UST curve */}
                      <line
                        x1={cx}
                        y1={cy}
                        x2={cx}
                        y2={getY(h.benchmarkUstYield)}
                        stroke={stroke}
                        strokeWidth="0.75"
                        strokeDasharray="2 2"
                        opacity="0.4"
                      />
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth="1.5"
                        className="cursor-pointer hover:opacity-100 transition-all opacity-85"
                        onClick={() => onSelectIsin && onSelectIsin(h.isin)}
                        onMouseEnter={() =>
                          setHoveredPoint({
                            type: 'holding',
                            title: h.name,
                            subtitle: `${h.isin} · ${h.assetClass}`,
                            xVal: cx,
                            yVal: cy,
                            details: [
                              { label: 'Maturity', value: `${h.years.toFixed(2)} yrs` },
                              { label: 'Holding YTM', value: `${h.ytmPct.toFixed(2)}%`, color: 'text-white' },
                              {
                                label: 'Spread o/ UST',
                                value: `${h.spreadBps >= 0 ? '+' : ''}${h.spreadBps} bps`,
                                color: h.spreadBps >= 0 ? 'text-amber-400' : 'text-emerald-400',
                              },
                              { label: 'Rating', value: h.rating },
                              { label: 'Mod Duration', value: `${h.duration.toFixed(2)} yrs` },
                              {
                                label: 'Market Value',
                                value: `$${Math.round(h.marketValue).toLocaleString()} (${h.weight.toFixed(1)}%)`,
                              },
                            ],
                          })
                        }
                      />
                    </g>
                  );
                })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="absolute z-20 pointer-events-none bg-slate-900/95 border border-slate-700/80 rounded-md p-2.5 shadow-xl font-mono text-[11px] backdrop-blur-xs min-w-[220px]"
                style={{
                  left: Math.min(svgWidth - 250, Math.max(10, hoveredPoint.xVal - 110)),
                  top: Math.max(10, hoveredPoint.yVal - 130),
                }}
              >
                <div className="font-bold text-white text-xs truncate">{hoveredPoint.title}</div>
                <div className="text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1.5">
                  {hoveredPoint.subtitle}
                </div>
                <div className="space-y-1">
                  {hoveredPoint.details.map((d) => (
                    <div key={d.label} className="flex items-center justify-between gap-3">
                      <span className="text-slate-400 text-[10px]">{d.label}:</span>
                      <span className={`font-bold tabular-nums ${d.color || 'text-slate-200'}`}>
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. KEY RATE DURATIONS (KRD) CHART CONTENT */}
      {activeTab === 'krd' && (
        <div className="space-y-3">
          {/* KRD Explanatory Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded border border-slate-800/60 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-300">
                Key Rate Duration measures portfolio sensitivity to localized 1bp rate moves at each tenor:
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Total Portfolio Duration:{' '}
                <strong className="text-white">
                  {analytics.keyRateDurations.reduce((s, k) => s + k.duration, 0).toFixed(2)} yrs
                </strong>
              </span>
              <span className="text-slate-400">
                Total DV01:{' '}
                <strong className="text-emerald-400">
                  ${Math.round(analytics.keyRateDurations.reduce((s, k) => s + k.dv01, 0)).toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* Interactive KRD Bar & DV01 Chart */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800/90 p-4">
            {/* SVG Visual Chart */}
            <svg viewBox="0 0 840 260" className="w-full h-auto select-none">
              <defs>
                <linearGradient id="krdBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="dv01Area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.5, 1.0, 1.5, 2.0].map((val) => {
                const y = 200 - (val / 2.0) * 160;
                return (
                  <g key={val}>
                    <line
                      x1={50}
                      y1={y}
                      x2={800}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="0.8"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={42}
                      y={y + 3.5}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val.toFixed(1)}y
                    </text>
                  </g>
                );
              })}

              {/* KRD Bars */}
              {analytics.keyRateDurations.map((krd, idx) => {
                const barWidth = 44;
                const slotWidth = 750 / 9;
                const x = 55 + idx * slotWidth + (slotWidth - barWidth) / 2;
                const barHeight = Math.min(160, Math.max(4, (krd.duration / 2.0) * 160));
                const y = 200 - barHeight;

                return (
                  <g key={krd.tenor} className="cursor-pointer group">
                    {/* Duration Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="3"
                      fill="url(#krdBarGrad)"
                      className="transition-all hover:opacity-90"
                    />
                    {/* Tenor Label */}
                    <text
                      x={x + barWidth / 2}
                      y={218}
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {krd.tenor}
                    </text>
                    {/* Duration Value over bar */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      fill="#ffffff"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {krd.duration.toFixed(2)}y
                    </text>
                    {/* DV01 value below tenor */}
                    <text
                      x={x + barWidth / 2}
                      y={232}
                      fill="#34d399"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      ${Math.round(krd.dv01)}
                    </text>
                    {/* % Share below DV01 */}
                    <text
                      x={x + barWidth / 2}
                      y={245}
                      fill="#64748b"
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {krd.percentage.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* DV01 connecting spline line across key rates */}
              {(() => {
                const maxDv01 = Math.max(
                  ...analytics.keyRateDurations.map((k) => k.dv01),
                  100
                );
                const slotWidth = 750 / 9;
                const pts = analytics.keyRateDurations.map((krd, idx) => {
                  const x = 55 + idx * slotWidth + slotWidth / 2;
                  const y = 200 - (krd.dv01 / maxDv01) * 150;
                  return { x, y };
                });

                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length; i++) {
                  d += ` L ${pts[i].x} ${pts[i].y}`;
                }

                return (
                  <path
                    d={d}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.75"
                    strokeDasharray="4 2"
                    opacity="0.8"
                  />
                );
              })()}

              {/* Chart Base Axis */}
              <line x1={50} y1={200} x2={800} y2={200} stroke="#475569" strokeWidth="1" />
            </svg>
          </div>

          {/* Detailed Tabular Attribution */}
          <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 font-mono text-[11px]">
            {analytics.keyRateDurations.map((krd) => (
              <div
                key={krd.tenor}
                className="bg-slate-950 p-2 rounded border border-slate-800 text-center space-y-0.5"
              >
                <div className="font-bold text-indigo-300 text-xs">{krd.tenor}</div>
                <div className="text-white font-bold tabular-nums">{krd.duration.toFixed(2)}y</div>
                <div className="text-[10px] text-emerald-400 tabular-nums">
                  ${krd.dv01.toFixed(1)}
                </div>
                <div className="text-[9px] text-slate-500 tabular-nums">
                  {krd.percentage.toFixed(1)}% dur
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. YIELD CURVE SCENARIOS & SHIFT SIMULATOR */}
      {activeTab === 'scenarios' && (
        <div className="space-y-3">
          {/* Scenario Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs">
            {[
              { id: 'base', label: 'Base Market Curve', desc: 'Current Fixings' },
              { id: 'parallel_up', label: '+50 bps Bear Shock', desc: 'Parallel Shift Up' },
              { id: 'parallel_down', label: '-50 bps Bull Rally', desc: 'Parallel Shift Down' },
              { id: 'steepener', label: 'Bull Steepener', desc: '-30bp 2Y / +30bp 30Y' },
              { id: 'flattener', label: 'Bear Flattener', desc: '+50bp 2Y / +10bp 30Y' },
              { id: 'inversion', label: 'Curve Inversion', desc: '+75bp 2Y / -25bp 10Y' },
            ].map((sc) => {
              const isSelected = activeScenario === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenario(sc.id as ScenarioType)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>{sc.label}</span>
                    {isSelected && <Check className="w-3 h-3 text-indigo-400" />}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{sc.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Scenario Impact Banner */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-slate-400">Simulated Scenario: </span>
                <strong className="text-white">{scenarioImpact.label}</strong>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-slate-400">
                P&amp;L Impact:{' '}
                <strong
                  className={`tabular-nums ${
                    scenarioImpact.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {scenarioImpact.pnl >= 0 ? '+' : ''}$
                  {Math.round(scenarioImpact.pnl).toLocaleString()} {baseCurrency}
                </strong>
              </div>
              <div className="text-slate-400">
                Return Impact:{' '}
                <strong
                  className={`tabular-nums ${
                    scenarioImpact.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {scenarioImpact.pct >= 0 ? '+' : ''}
                  {scenarioImpact.pct.toFixed(2)}%
                </strong>
              </div>
            </div>
          </div>

          {/* Visual Curve Comparison Canvas */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800/90 overflow-hidden">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto select-none">
              {/* Grid Lines */}
              {yTicks.map((tick) => {
                const y = getY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="0.8"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 3.5}
                      fill="#64748b"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {tick.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* Ticks */}
              {xTicks.map((tick) => {
                const x = getX(tick.years);
                return (
                  <g key={tick.label}>
                    <line
                      x1={x}
                      y1={padTop}
                      x2={x}
                      y2={padTop + chartH}
                      stroke="#1e293b"
                      strokeWidth="0.8"
                    />
                    <text
                      x={x}
                      y={padTop + chartH + 16}
                      fill="#94a3b8"
                      fontSize="9.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {tick.label}
                    </text>
                  </g>
                );
              })}

              {/* Base UST Curve (Dashed Gray) */}
              <path
                d={generateCurvePath(curvesMap.UST)}
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeDasharray="4 3"
              />

              {/* Shifted Scenario Curve (Glowing Solid) */}
              {activeScenario !== 'base' && (
                <path
                  d={generateCurvePath(
                    curvesMap.UST.map((p) => ({
                      years: p.years,
                      rate: p.rate + getScenarioShiftForYear(activeScenario, p.years) / 10000,
                    }))
                  )}
                  fill="none"
                  stroke={scenarioImpact.pnl >= 0 ? '#34d399' : '#f43f5e'}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}

              {/* Nodes for Shifted Curve */}
              {activeScenario !== 'base' &&
                curvesMap.UST.map((p) => {
                  const shift = getScenarioShiftForYear(activeScenario, p.years);
                  const cx = getX(p.years);
                  const cy = getY((p.rate + shift / 10000) * 100);
                  return (
                    <circle
                      key={p.tenor}
                      cx={cx}
                      cy={cy}
                      r="4"
                      fill={scenarioImpact.pnl >= 0 ? '#10b981' : '#e11d48'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })}

              {/* Baselines */}
              <line
                x1={padLeft}
                y1={padTop + chartH}
                x2={svgWidth - padRight}
                y2={padTop + chartH}
                stroke="#475569"
                strokeWidth="1"
              />
              <line
                x1={padLeft}
                y1={padTop}
                x2={padLeft}
                y2={padTop + chartH}
                stroke="#475569"
                strokeWidth="1"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
