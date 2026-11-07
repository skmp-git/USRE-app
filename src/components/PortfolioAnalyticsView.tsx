/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  PortfolioValuationResult,
  Instrument,
  SecurityPeriodReturn,
  YieldCurvePoint,
} from '../types/portfolio';
import {
  HoldingsTable,
} from './HoldingsTable';
import {
  RiskAggregationView,
} from './RiskAggregationView';
import {
  FloatingRateScheduleView,
} from './FloatingRateScheduleView';
import {
  SensitivitySimulatorView,
} from './SensitivitySimulatorView';
import {
  YieldCurveStructureCharts,
} from './YieldCurveStructureCharts';
import {
  AssetClassContributedReturnView,
} from './AssetClassContributedReturnView';
import {
  SAMPLE_YIELD_CURVES,
} from '../services/sampleData';
import {
  TrendingUp,
  Percent,
  Clock,
  DollarSign,
  ShieldAlert,
  Sliders,
  Layers,
  Table,
  Zap,
  Activity,
  BarChart3,
  Shield,
  Layers3,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';

interface PortfolioAnalyticsViewProps {
  analytics: PortfolioValuationResult;
  baseCurrency: Currency;
  yieldCurves?: YieldCurvePoint[];
  onSelectInstrument: (instrument: Instrument) => void;
  onTradeInstrument: (isin: string, type: 'BUY' | 'SELL' | 'COUPON' | 'REDEMPTION') => void;
}

export const PortfolioAnalyticsView: React.FC<PortfolioAnalyticsViewProps> = ({
  analytics,
  baseCurrency,
  yieldCurves,
  onSelectInstrument,
  onTradeInstrument,
}) => {
  const [subTab, setSubTab] = useState<'holdings' | 'performance' | 'aggregations' | 'floating' | 'stress'>('holdings');
  const [perfSortField, setPerfSortField] = useState<keyof SecurityPeriodReturn>('totalReturnPct');
  const [perfSortAsc, setPerfSortAsc] = useState<boolean>(false);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const isProfit = analytics.unrealizedPnL >= 0;

  // Maximum KRD for bar scaling
  const maxKrd = Math.max(...analytics.keyRateDurations.map((k) => k.duration), 0.1);

  // Group credit ratings into Investment Grade vs High Yield
  const igRatings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-'];
  const igMarketValue = analytics.breakdowns.byRating
    .filter((r) => igRatings.includes(r.category))
    .reduce((sum, r) => sum + r.marketValue, 0);
  const igWeight = analytics.totalPortfolioValue > 0 ? (igMarketValue / analytics.totalPortfolioValue) * 100 : 0;

  // Sorting security returns
  const sortedSecurityReturns = [...(analytics.returns?.securityReturns || [])].sort((a, b) => {
    const aVal = a[perfSortField];
    const bVal = b[perfSortField];
    if (typeof aVal === 'string') {
      return perfSortAsc ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
    }
    return perfSortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  return (
    <div className="space-y-4">
      {/* 1. Top Level Aggregate Metrics Card Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Total Portfolio Value */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
            Total Portfolio Value
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
            {formatNumber(analytics.totalPortfolioValue, 0)}
            <span className="text-xs font-normal text-slate-400 ml-1">{baseCurrency}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Holdings + Cash ({analytics.positions.length} pos)
          </div>
        </div>

        {/* Metric 2: Holdings Market Value */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
            Holdings Market Value
          </div>
          <div className="text-xl font-bold font-mono text-slate-200 mt-1 tabular-nums">
            {formatNumber(analytics.totalHoldingsValue, 0)}
          </div>
          <div className={`text-[10px] font-mono mt-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            Unrealized P&L: {isProfit ? '+' : ''}{formatNumber(analytics.unrealizedPnL, 0)}
          </div>
        </div>

        {/* Metric 3: Total Cash */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide flex items-center justify-between">
            <span>Total Cash Balance</span>
            <span className="text-[10px] text-indigo-400 font-mono">
              {Object.values(analytics.cashBalances).filter((b) => Math.abs(b) > 0).length} CCYs
            </span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            {formatNumber(analytics.totalCashValue, 0)}
            <span className="text-xs font-normal text-slate-400 ml-1">{baseCurrency}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 truncate" title="Multi-Currency Cash Reserves">
            {Object.entries(analytics.cashBalances)
              .filter(([_, bal]) => Math.abs(bal) > 0)
              .slice(0, 4)
              .map(([ccy, bal]) => (
                <span key={ccy} className="text-slate-300">
                  {ccy}: {bal >= 1000000 ? `${(bal / 1000000).toFixed(1)}M` : `${(bal / 1000).toFixed(0)}k`}
                </span>
              ))}
            {Object.entries(analytics.cashBalances).filter(([_, bal]) => Math.abs(bal) > 0).length > 4 && (
              <span className="text-indigo-400">+{Object.entries(analytics.cashBalances).filter(([_, bal]) => Math.abs(bal) > 0).length - 4} more</span>
            )}
          </div>
        </div>

        {/* Metric 4: Weighted YTM */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
            Weighted Average YTM
          </div>
          <div className="text-xl font-bold font-mono text-indigo-400 mt-1 tabular-nums">
            {(analytics.weightedYtm * 100).toFixed(2)}%
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            Weighted Coupon: {(analytics.weightedCoupon * 100).toFixed(2)}%
          </div>
        </div>

        {/* Metric 5: Modified Duration */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
            Portfolio Mod Duration
          </div>
          <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
            {analytics.weightedDuration.toFixed(2)} <span className="text-xs font-normal text-slate-400">yrs</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-1">
            MacD: {analytics.weightedMacaulayDuration.toFixed(2)}y · Cvx: {analytics.weightedConvexity.toFixed(2)}
          </div>
        </div>

        {/* Metric 6: Total DV01 */}
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
            Total Portfolio DV01
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
            ${formatNumber(analytics.totalDv01, 1)}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            Dollar value per +1 bp shift
          </div>
        </div>
      </div>

      {/* 2. TOTAL RETURN ATTRIBUTION & PERFORMANCE CARDS (YTD, QTD, MTD) */}
      {analytics.returns && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                  Fixed Income Total Return &amp; Performance Attribution (YTD · QTD · MTD)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total return includes clean price changes + coupon accrual interest accumulation + cash distributions paid.
                </p>
              </div>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                <span>Coupon Return (Accrual + Cash)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500 inline-block" />
                <span>Price Return (Capital Gain)</span>
              </span>
            </div>
          </div>

          {/* 3 Period Cards: YTD, QTD, MTD */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[analytics.returns.ytd, analytics.returns.qtd, analytics.returns.mtd].map((ret) => {
              const isPos = ret.totalReturnPct >= 0;
              const couponRatio = ret.totalReturnPct !== 0
                ? Math.min(100, Math.max(0, (Math.abs(ret.couponReturnPct) / (Math.abs(ret.couponReturnPct) + Math.abs(ret.priceReturnPct))) * 100))
                : 50;

              return (
                <div
                  key={ret.period}
                  className="bg-slate-950 p-4 rounded-lg border border-slate-800/90 flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200 font-mono tracking-wide">
                        {ret.label}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {ret.startDate} → {ret.endDate}
                      </span>
                    </div>

                    {/* Total Return Headline */}
                    <div className="flex items-baseline gap-2.5 my-2">
                      <span className={`text-2xl font-bold font-mono tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPos ? '+' : ''}{ret.totalReturnPct.toFixed(2)}%
                      </span>
                      <span className="text-xs text-slate-400 font-mono tabular-nums">
                        ({isPos ? '+' : ''}{formatNumber(ret.totalReturnDollar, 0)} {baseCurrency})
                      </span>
                    </div>

                    {/* Visual Return Composition Stacked Bar */}
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex my-2.5 border border-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${couponRatio}%` }}
                        title={`Coupon Return: ${ret.couponReturnPct.toFixed(2)}%`}
                      />
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${100 - couponRatio}%` }}
                        title={`Price Return: ${ret.priceReturnPct.toFixed(2)}%`}
                      />
                    </div>
                  </div>

                  {/* Return Breakdown Components */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                    {/* Coupon Return */}
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Coupon Return</span>
                      </div>
                      <div className="text-xs font-bold text-emerald-400 mt-0.5 tabular-nums">
                        {ret.couponReturnPct >= 0 ? '+' : ''}{ret.couponReturnPct.toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        {ret.couponReturnDollar >= 0 ? '+' : ''}{formatNumber(ret.couponReturnDollar, 0)} {baseCurrency}
                      </div>
                    </div>

                    {/* Price Return */}
                    <div className="bg-slate-900/60 p-2 rounded border border-slate-800/40">
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        <span>Price Return</span>
                      </div>
                      <div className={`text-xs font-bold mt-0.5 tabular-nums ${ret.priceReturnPct >= 0 ? 'text-indigo-300' : 'text-rose-400'}`}>
                        {ret.priceReturnPct >= 0 ? '+' : ''}{ret.priceReturnPct.toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        {ret.priceReturnDollar >= 0 ? '+' : ''}{formatNumber(ret.priceReturnDollar, 0)} {baseCurrency}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. YIELD CURVE TERM STRUCTURE & KEY RATE DURATIONS CHARTS */}
      <YieldCurveStructureCharts
        analytics={analytics}
        yieldCurves={yieldCurves && yieldCurves.length > 0 ? yieldCurves : SAMPLE_YIELD_CURVES}
        baseCurrency={baseCurrency}
        onSelectIsin={(isin) => {
          const pos = analytics.positions.find((p) => p.isin === isin);
          if (pos) onSelectInstrument(pos.instrument);
        }}
      />

      {/* 4. THREE STRATEGIC PORTFOLIO DISTRIBUTIONS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Distribution 1: Holdings in Bins on Coupon Rates */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                  Coupon Rate Distribution
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Holdings Bins</span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {analytics.couponDistributions.map((bin) => {
                const barWidth = Math.min(100, Math.max(bin.portfolioWeight > 0 ? 3 : 0, bin.portfolioWeight));

                return (
                  <div key={bin.binLabel} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400 text-[10px]">{bin.binLabel}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px]">({bin.holdingsCount} pos)</span>
                        <span className="font-bold text-white tabular-nums">
                          {formatNumber(bin.marketValue, 0)} {baseCurrency}
                        </span>
                        <span className="text-indigo-300 w-10 text-right tabular-nums">
                          {bin.portfolioWeight.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Bar */}
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Portfolio Weighted Coupon:</span>
            <span className="text-white font-bold">{(analytics.weightedCoupon * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* Distribution 2: Portfolio Market Value by Payment Rank (Seniority) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Layers3 className="w-3.5 h-3.5 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                  Payment Rank / Seniority
                </h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Market Value</span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {analytics.paymentRankDistributions.map((rank) => {
                const barWidth = Math.min(100, Math.max(rank.portfolioWeight > 0 ? 3 : 0, rank.portfolioWeight));

                return (
                  <div key={rank.category} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-300 font-sans text-xs truncate max-w-[150px]" title={rank.category}>
                        {rank.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tabular-nums">
                          {formatNumber(rank.marketValue, 0)} {baseCurrency}
                        </span>
                        <span className="text-emerald-400 w-10 text-right tabular-nums">
                          {rank.portfolioWeight.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Bar */}
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Sovereign &amp; Senior Secured:</span>
            <span className="text-emerald-400 font-bold">
              {(
                analytics.paymentRankDistributions
                  .filter((p) => p.category.includes('Sovereign') || p.category.includes('Secured'))
                  .reduce((s, p) => s + p.portfolioWeight, 0)
              ).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Distribution 3: Portfolio Based on Credit Rating */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                  Credit Rating Distribution
                </h4>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                IG: {igWeight.toFixed(1)}%
              </span>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {analytics.breakdowns.byRating.map((rating) => {
                const barWidth = Math.min(100, Math.max(rating.portfolioWeight > 0 ? 3 : 0, rating.portfolioWeight));
                const isIG = igRatings.includes(rating.category);

                return (
                  <div key={rating.category} className="space-y-1">
                    <div className="flex items-center justify-between text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          ['AAA', 'AA+', 'AA', 'AA-'].includes(rating.category)
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : ['A+', 'A', 'A-'].includes(rating.category)
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                            : ['BBB+', 'BBB', 'BBB-'].includes(rating.category)
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                        }`}>
                          {rating.category}
                        </span>
                        <span className="text-[10px] text-slate-500">{rating.weightedDuration.toFixed(1)}y dur</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tabular-nums">
                          {formatNumber(rating.marketValue, 0)} {baseCurrency}
                        </span>
                        <span className="text-amber-300 w-10 text-right tabular-nums">
                          {rating.portfolioWeight.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Bar */}
                    <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/50">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isIG ? 'bg-amber-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>High Yield / Speculative:</span>
            <span className="text-purple-400 font-bold">
              {(100 - igWeight).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Warnings Banner if any */}
      {analytics.warnings.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 px-4 py-2.5 rounded-lg flex items-start gap-2.5 text-xs text-amber-300">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">Portfolio Valuation Warnings ({analytics.warnings.length}):</span>
            <ul className="list-disc list-inside text-[11px] text-amber-300/80">
              {analytics.warnings.slice(0, 3).map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 5. Sub-View Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
        <button
          onClick={() => setSubTab('holdings')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'holdings'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Holdings &amp; Risk View</span>
          <span className="font-mono text-[10px] opacity-75">({analytics.positions.length})</span>
        </button>

        <button
          onClick={() => setSubTab('performance')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'performance'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Performance Attribution Table</span>
          <span className="font-mono text-[10px] text-emerald-400">
            {analytics.returns.ytd.totalReturnPct >= 0 ? '+' : ''}{analytics.returns.ytd.totalReturnPct.toFixed(2)}% YTD
          </span>
        </button>

        <button
          onClick={() => setSubTab('aggregations')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'aggregations'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Risk Aggregations (Sector / Seniority / Rating)</span>
        </button>

        <button
          onClick={() => setSubTab('floating')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'floating'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Floating-Rate Reset Schedule</span>
          <span className="font-mono text-[10px] text-indigo-400">({analytics.floatingResets.length})</span>
        </button>

        <button
          onClick={() => setSubTab('stress')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
            subTab === 'stress'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Scenario &amp; Key Rate Shock</span>
        </button>
      </div>

      {/* Render Active Sub-View */}
      {subTab === 'holdings' && (
        <HoldingsTable
          positions={analytics.positions}
          baseCurrency={baseCurrency}
          onSelectInstrument={onSelectInstrument}
          onTradeInstrument={onTradeInstrument}
          portfolioReturns={analytics.returns}
          totalHoldingsValue={analytics.totalHoldingsValue}
        />
      )}

      {/* Sub-View: Performance Attribution Table with Contributed Returns & Asset Class Division */}
      {subTab === 'performance' && (
        <AssetClassContributedReturnView
          securityReturns={analytics.returns.securityReturns}
          assetClassContributions={analytics.returns.assetClassContributions}
          portfolioPeriodReturn={analytics.returns.ytd}
          baseCurrency={baseCurrency}
          totalHoldingsValue={analytics.totalHoldingsValue}
        />
      )}

      {subTab === 'aggregations' && (
        <RiskAggregationView
          breakdowns={analytics.breakdowns}
          baseCurrency={baseCurrency}
          totalPortfolioValue={analytics.totalPortfolioValue}
        />
      )}

      {subTab === 'floating' && (
        <FloatingRateScheduleView
          resets={analytics.floatingResets}
          baseCurrency={baseCurrency}
        />
      )}

      {subTab === 'stress' && (
        <SensitivitySimulatorView
          positions={analytics.positions}
          totalHoldingsValue={analytics.totalHoldingsValue}
          weightedDuration={analytics.weightedDuration}
          weightedConvexity={analytics.weightedConvexity}
          totalDv01={analytics.totalDv01}
          baseCurrency={baseCurrency}
        />
      )}
    </div>
  );
};
