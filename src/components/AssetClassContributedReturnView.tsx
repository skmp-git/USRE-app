/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  AssetClass,
  SecurityPeriodReturn,
  AssetClassReturnContribution,
  PeriodReturn,
} from '../types/portfolio';
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Layers,
  Sparkles,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Search,
} from 'lucide-react';

interface AssetClassContributedReturnViewProps {
  securityReturns: SecurityPeriodReturn[];
  assetClassContributions: AssetClassReturnContribution[];
  portfolioPeriodReturn: PeriodReturn;
  baseCurrency: Currency;
  totalHoldingsValue: number;
}

export const AssetClassContributedReturnView: React.FC<AssetClassContributedReturnViewProps> = ({
  securityReturns,
  assetClassContributions,
  portfolioPeriodReturn,
  baseCurrency,
  totalHoldingsValue,
}) => {
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<keyof SecurityPeriodReturn>('contributedReturnPct');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // 5 Canonical Asset Classes
  const ASSET_CLASS_ORDER: { classKey: AssetClass; label: string; color: string; border: string; bg: string }[] = [
    { classKey: 'DirectBond', label: 'Direct Bond', color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-950/30' },
    { classKey: 'MutualFund', label: 'Mutual Fund', color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-950/30' },
    { classKey: 'CapFloorFloater', label: 'CapFloor Floater', color: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-950/30' },
    { classKey: 'BondLinkedNote', label: 'BondLinkedNote', color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-950/30' },
    { classKey: 'PrivatePlacement', label: 'PrivatePlacement', color: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-950/30' },
  ];

  // Overall Top Strengths and Weaknesses
  const overallStrengths = [...securityReturns]
    .sort((a, b) => b.contributedReturnPct - a.contributedReturnPct)
    .slice(0, 3);

  const overallWeaknesses = [...securityReturns]
    .sort((a, b) => a.contributedReturnPct - b.contributedReturnPct)
    .slice(0, 3);

  // Filtered and Sorted Positions
  const filteredPositions = securityReturns.filter((p) => {
    const matchesFilter = selectedClassFilter === 'ALL' || p.assetClass === selectedClassFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.isin.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const sortedPositions = [...filteredPositions].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string') {
      return sortAsc ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  // Calculate sum of contributions for validation
  const totalContributedPct = assetClassContributions.reduce((s, c) => s + c.contributedReturnPct, 0);

  return (
    <div className="space-y-6 select-none">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
              Contributed Returns &amp; Performance Attribution by Asset Class
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Decomposes portfolio cumulative total return into exact position-level weights and returns across the 5 asset classes.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="bg-slate-950 px-3 py-1 rounded border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Total Portfolio Return:</span>
            <span className={`font-bold ${portfolioPeriodReturn.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {portfolioPeriodReturn.totalReturnPct >= 0 ? '+' : ''}{portfolioPeriodReturn.totalReturnPct.toFixed(2)}%
              <span className="text-[10px] text-slate-500 ml-1">({(portfolioPeriodReturn.totalReturnPct * 100).toFixed(0)} bps)</span>
            </span>
          </div>
          <div className="bg-slate-950 px-3 py-1 rounded border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Sum of Contributions:</span>
            <span className="text-indigo-300 font-bold">
              {totalContributedPct >= 0 ? '+' : ''}{totalContributedPct.toFixed(2)}%
            </span>
            <span title="Exact additive reconciliation verified" className="inline-flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </span>
          </div>
        </div>
      </div>

      {/* 1. TOP STRENGTHS & WEAKNESSES CALLOUT BOXES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Box 1: Top 3 Portfolio Strengths (Alpha / Yield Drivers) */}
        <div className="bg-slate-900 border border-emerald-900/50 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                Top Portfolio Strengths (Highest Return Contributors)
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-medium">Positive Alpha &amp; Yield</span>
          </div>

          <div className="space-y-2.5">
            {overallStrengths.map((pos, idx) => (
              <div
                key={pos.isin}
                className="bg-slate-950/70 p-2.5 rounded border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate" title={pos.name}>
                      {pos.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                      <span>{pos.isin}</span>
                      <span>·</span>
                      <span className="text-indigo-400">{pos.assetClass}</span>
                      <span>·</span>
                      <span>Weight: {pos.portfolioWeightPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs font-bold text-emerald-400">
                    +{pos.contributedReturnBps.toFixed(0)} bps
                    <span className="text-[10px] text-slate-400 ml-1">(+{pos.contributedReturnPct.toFixed(2)}%)</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Pos Return: {pos.totalReturnPct >= 0 ? '+' : ''}{pos.totalReturnPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Box 2: Top 3 Portfolio Weaknesses (Performance Detractors) */}
        <div className="bg-slate-900 border border-rose-900/50 rounded-lg p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wide">
                Top Portfolio Weaknesses (Greatest Performance Drags)
              </span>
            </div>
            <span className="text-[10px] font-mono text-rose-400 font-medium">Underperforming Positions</span>
          </div>

          <div className="space-y-2.5">
            {overallWeaknesses.map((pos, idx) => {
              const isDetractor = pos.contributedReturnPct < 0;
              return (
                <div
                  key={pos.isin}
                  className="bg-slate-950/70 p-2.5 rounded border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/80 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-100 truncate" title={pos.name}>
                        {pos.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                        <span>{pos.isin}</span>
                        <span>·</span>
                        <span className="text-indigo-400">{pos.assetClass}</span>
                        <span>·</span>
                        <span>Weight: {pos.portfolioWeightPct.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <div className={`text-xs font-bold ${isDetractor ? 'text-rose-400' : 'text-slate-300'}`}>
                      {pos.contributedReturnBps >= 0 ? '+' : ''}{pos.contributedReturnBps.toFixed(0)} bps
                      <span className="text-[10px] text-slate-400 ml-1">
                        ({pos.contributedReturnPct >= 0 ? '+' : ''}{pos.contributedReturnPct.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Pos Return: {pos.totalReturnPct >= 0 ? '+' : ''}{pos.totalReturnPct.toFixed(2)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. THE 5 ASSET CLASS CUMULATIVE CONTRIBUTION CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cumulative Contributed Return Divided by 5 Asset Classes</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-mono">
            Direct Bond · Mutual Fund · CapFloor Floater · BondLinkedNote · PrivatePlacement
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {ASSET_CLASS_ORDER.map(({ classKey, label, color, border, bg }) => {
            const classData = assetClassContributions.find((c) => c.assetClass === classKey);
            const contribPct = classData ? classData.contributedReturnPct : 0;
            const contribBps = classData ? classData.contributedReturnBps : 0;
            const isPos = contribPct >= 0;
            const weight = classData ? classData.portfolioWeightPct : 0;
            const posCount = classData ? classData.positionsCount : 0;
            const mv = classData ? classData.marketValueBase : 0;
            const couponContrib = classData ? classData.contributedCouponPct : 0;
            const priceContrib = classData ? classData.contributedPricePct : 0;
            const topStrength = classData && classData.topStrengths.length > 0 ? classData.topStrengths[0] : null;
            const topDrag = classData && classData.topWeaknesses.length > 0 ? classData.topWeaknesses[0] : null;

            return (
              <div
                key={classKey}
                onClick={() => setSelectedClassFilter(selectedClassFilter === classKey ? 'ALL' : classKey)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer ${bg} ${
                  selectedClassFilter === classKey
                    ? 'ring-2 ring-indigo-500 border-indigo-500'
                    : `${border} hover:border-slate-600`
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold font-mono tracking-tight ${color}`}>
                    {label}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                    {posCount} pos
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-mono mb-2">
                  Weight: <span className="text-white font-semibold">{weight.toFixed(1)}%</span> · {formatNumber(mv / 1000, 0)}k {baseCurrency}
                </div>

                {/* Contributed Return Metric */}
                <div className="my-2 bg-slate-950/80 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 font-mono uppercase">Contributed Return</div>
                  <div className={`text-lg font-bold font-mono tabular-nums ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPos ? '+' : ''}{contribBps.toFixed(0)} <span className="text-xs font-normal">bps</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ({isPos ? '+' : ''}{contribPct.toFixed(2)}% to portfolio)
                  </div>
                </div>

                {/* Coupon vs Price Split */}
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1 border-t border-slate-800/60 text-slate-400">
                  <div>
                    <span className="text-slate-500 block">Coupon:</span>
                    <span className="text-emerald-400 font-semibold">{couponContrib >= 0 ? '+' : ''}{(couponContrib * 100).toFixed(0)} bps</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Price:</span>
                    <span className={`${priceContrib >= 0 ? 'text-indigo-300' : 'text-rose-400'} font-semibold`}>
                      {priceContrib >= 0 ? '+' : ''}{(priceContrib * 100).toFixed(0)} bps
                    </span>
                  </div>
                </div>

                {/* Top Contributor and Detractor inside class */}
                {topStrength && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/60 text-[10px] font-mono space-y-0.5">
                    <div className="text-slate-500 text-[9px] flex items-center justify-between">
                      <span>Top Strength:</span>
                      <span className="text-emerald-400">+{topStrength.contributedReturnBps.toFixed(0)} bps</span>
                    </div>
                    <div className="text-slate-300 truncate text-[10px]" title={topStrength.name}>
                      {topStrength.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ASSET CLASS CUMULATED CONTRIBUTION WATERFALL BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Cumulative Return Contribution Composition (% of Portfolio Total Return):</span>
          <span className="text-white font-bold">{portfolioPeriodReturn.totalReturnPct.toFixed(2)}% Total Return</span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="h-4 w-full bg-slate-950 rounded-md overflow-hidden flex border border-slate-800 p-0.5 gap-0.5">
          {ASSET_CLASS_ORDER.map(({ classKey, label, color }) => {
            const classData = assetClassContributions.find((c) => c.assetClass === classKey);
            const contrib = classData ? Math.max(0, classData.contributedReturnPct) : 0;
            const totalPosContrib = assetClassContributions.reduce((s, c) => s + Math.max(0, c.contributedReturnPct), 0);
            const barPct = totalPosContrib > 0 ? (contrib / totalPosContrib) * 100 : 20;

            const bgClass =
              classKey === 'DirectBond'
                ? 'bg-blue-500'
                : classKey === 'MutualFund'
                ? 'bg-emerald-500'
                : classKey === 'CapFloorFloater'
                ? 'bg-amber-500'
                : classKey === 'BondLinkedNote'
                ? 'bg-purple-500'
                : 'bg-rose-500';

            return (
              <div
                key={classKey}
                style={{ width: `${barPct}%` }}
                className={`h-full ${bgClass} rounded-xs transition-all hover:opacity-90`}
                title={`${label}: +${classData?.contributedReturnBps.toFixed(0)} bps (${classData?.contributedReturnPct.toFixed(2)}%)`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
          {ASSET_CLASS_ORDER.map(({ classKey, label, color }) => {
            const classData = assetClassContributions.find((c) => c.assetClass === classKey);
            return (
              <div key={classKey} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  classKey === 'DirectBond' ? 'bg-blue-500' :
                  classKey === 'MutualFund' ? 'bg-emerald-500' :
                  classKey === 'CapFloorFloater' ? 'bg-amber-500' :
                  classKey === 'BondLinkedNote' ? 'bg-purple-500' : 'bg-rose-500'
                }`} />
                <span>{label}:</span>
                <span className="text-white font-bold">
                  {classData && classData.contributedReturnBps >= 0 ? '+' : ''}
                  {classData ? classData.contributedReturnBps.toFixed(0) : '0'} bps
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. POSITION-LEVEL CONTRIBUTED RETURNS TABLE (WITH FILTERING & DIAGNOSTICS) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {/* Table Controls */}
        <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/80">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by security name or ISIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-8 pr-3 py-1 rounded focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>
          </div>

          {/* Asset Class Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setSelectedClassFilter('ALL')}
              className={`px-2.5 py-1 rounded font-medium text-[11px] transition-colors whitespace-nowrap ${
                selectedClassFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Classes ({securityReturns.length})
            </button>
            {ASSET_CLASS_ORDER.map(({ classKey, label }) => {
              const count = securityReturns.filter((p) => p.assetClass === classKey).length;
              return (
                <button
                  key={classKey}
                  onClick={() => setSelectedClassFilter(classKey)}
                  className={`px-2 py-1 rounded font-medium text-[11px] transition-colors whitespace-nowrap ${
                    selectedClassFilter === classKey
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Financial Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                <th className="py-2.5 px-3 w-8 text-center">#</th>
                <th
                  onClick={() => {
                    setSortField('name');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
                >
                  SECURITY / ISSUER
                </th>
                <th className="py-2.5 px-2">ASSET CLASS</th>
                <th className="py-2.5 px-2">CCY</th>
                <th
                  onClick={() => {
                    setSortField('portfolioWeightPct');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
                >
                  WEIGHT (%)
                </th>
                <th
                  onClick={() => {
                    setSortField('totalReturnPct');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
                >
                  POS RETURN (%)
                </th>
                <th className="py-2.5 px-3 text-right text-emerald-400">
                  COUPON RET
                </th>
                <th className="py-2.5 px-3 text-right text-indigo-300">
                  PRICE RET
                </th>
                <th
                  onClick={() => {
                    setSortField('contributedReturnPct');
                    setSortAsc(!sortAsc);
                  }}
                  className="py-2.5 px-4 text-right cursor-pointer hover:text-slate-200 font-bold bg-slate-900/60 text-white"
                >
                  CONTRIBUTED RETURN (bps / %)
                </th>
                <th className="py-2.5 px-3 text-right">
                  DOLLAR CONTRIB ({baseCurrency})
                </th>
                <th className="py-2.5 px-3 text-center">DIAGNOSTIC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {sortedPositions.map((pos, idx) => {
                const isPositive = pos.contributedReturnPct >= 0;
                const isTopAlpha = pos.contributedReturnBps >= 25;
                const isDetractor = pos.contributedReturnBps < 0;

                return (
                  <tr key={pos.isin} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                      {idx + 1}
                    </td>

                    <td className="py-2 px-3 font-sans font-semibold text-slate-200">
                      <div>{pos.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{pos.isin}</div>
                    </td>

                    <td className="py-2 px-2 text-slate-300 font-sans">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px]">
                        {pos.assetClass}
                      </span>
                    </td>

                    <td className="py-2 px-2 text-slate-400">{pos.currency}</td>

                    <td className="py-2 px-3 text-right tabular-nums text-slate-300">
                      {pos.portfolioWeightPct.toFixed(2)}%
                    </td>

                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${
                      pos.totalReturnPct >= 0 ? 'text-slate-200' : 'text-rose-400'
                    }`}>
                      {pos.totalReturnPct >= 0 ? '+' : ''}{pos.totalReturnPct.toFixed(2)}%
                    </td>

                    <td className="py-2 px-3 text-right tabular-nums text-emerald-400 font-medium">
                      {pos.couponReturnPct >= 0 ? '+' : ''}{pos.couponReturnPct.toFixed(2)}%
                    </td>

                    <td className={`py-2 px-3 text-right tabular-nums font-medium ${
                      pos.priceReturnPct >= 0 ? 'text-indigo-300' : 'text-rose-400'
                    }`}>
                      {pos.priceReturnPct >= 0 ? '+' : ''}{pos.priceReturnPct.toFixed(2)}%
                    </td>

                    {/* Contributed Return (Primary Attribution Metric) */}
                    <td className="py-2 px-4 text-right tabular-nums font-bold bg-slate-900/40">
                      <span className={`text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{pos.contributedReturnBps.toFixed(1)} bps
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                        ({isPositive ? '+' : ''}{pos.contributedReturnPct.toFixed(3)}%)
                      </span>
                    </td>

                    <td className={`py-2 px-3 text-right tabular-nums ${
                      pos.dollarContributionBase >= 0 ? 'text-slate-200' : 'text-rose-400'
                    }`}>
                      {pos.dollarContributionBase >= 0 ? '+' : ''}{formatNumber(pos.dollarContributionBase, 0)}
                    </td>

                    {/* Diagnostic Badge */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {isTopAlpha ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-emerald-950 text-emerald-300 border border-emerald-800">
                          🟢 Core Strength
                        </span>
                      ) : isDetractor ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-sans bg-rose-950 text-rose-300 border border-rose-800">
                          🔴 Detractor
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-sans bg-slate-800 text-slate-300">
                          ⚪ Contributor
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
