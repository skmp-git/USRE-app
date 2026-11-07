/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  AssetClass,
  PositionValuation,
  Instrument,
  PeriodReturn,
} from '../types/portfolio';
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ArrowUpDown,
  PlusCircle,
  BarChart2,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';

interface HoldingsTableProps {
  positions: PositionValuation[];
  baseCurrency: Currency;
  onSelectInstrument: (instrument: Instrument) => void;
  onTradeInstrument: (isin: string, type: 'BUY' | 'SELL' | 'COUPON' | 'REDEMPTION') => void;
  portfolioReturns?: {
    ytd: PeriodReturn;
    qtd: PeriodReturn;
    mtd: PeriodReturn;
  };
  totalHoldingsValue?: number;
}

export const HoldingsTable: React.FC<HoldingsTableProps> = ({
  positions,
  baseCurrency,
  onSelectInstrument,
  onTradeInstrument,
  portfolioReturns,
  totalHoldingsValue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('ALL');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('ALL');
  const [expandedIsin, setExpandedIsin] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof PositionValuation>('marketValueBase');
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'performance' | 'risk'>('all');

  const assetClasses = [
    { label: 'All Assets', value: 'ALL' },
    { label: 'Direct Bonds', value: 'DirectBond' },
    { label: 'Mutual Funds', value: 'MutualFund' },
    { label: 'Cap-Floor Floaters', value: 'CapFloorFloater' },
    { label: 'Bond-Linked Notes', value: 'BondLinkedNote' },
    { label: 'Private Placements', value: 'PrivatePlacement' },
  ];

  // Filtering
  const filtered = positions.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.isin.toLowerCase().includes(q) ||
      p.instrument.name.toLowerCase().includes(q) ||
      p.instrument.issuer.toLowerCase().includes(q);

    const matchClass = selectedAssetClass === 'ALL' || p.instrument.assetClass === selectedAssetClass;
    const matchCcy = selectedCurrency === 'ALL' || p.instrument.currency === selectedCurrency;

    return matchSearch && matchClass && matchCcy;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'instrument') {
      aVal = a.instrument.name;
      bVal = b.instrument.name;
    }

    if (typeof aVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
  });

  const handleSort = (field: keyof PositionValuation) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Portfolio Totals for KPI Summary
  const totalMv = positions.reduce((s, p) => s + p.marketValueBase, 0);
  const totalCost = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnL = totalMv - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const isPortfolioProfitable = totalPnL >= 0;

  const portfolioYtdPct =
    portfolioReturns?.ytd?.totalReturnPct ??
    (totalMv > 0
      ? positions.reduce((s, p) => s + (p.ytdReturnPct || 0) * (p.marketValueBase / totalMv), 0)
      : 0);

  const portfolioMtdPct =
    portfolioReturns?.mtd?.totalReturnPct ??
    (totalMv > 0
      ? positions.reduce((s, p) => s + (p.mtdReturnPct || 0) * (p.marketValueBase / totalMv), 0)
      : 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
      {/* Controls Bar */}
      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by ISIN, Issuer, or Security Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-3 py-1.5 rounded focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap text-[11px] ${
                viewMode === 'all'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View all columns: Risk, Valuation, Cost P/L & Period Returns"
            >
              All Columns
            </button>
            <button
              onClick={() => setViewMode('performance')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap text-[11px] ${
                viewMode === 'performance'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Focus on Cost Basis, Cost P/L ($ & %), YTD & MTD Returns"
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Performance &amp; P/L</span>
            </button>
            <button
              onClick={() => setViewMode('risk')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap text-[11px] ${
                viewMode === 'risk'
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Focus on Duration, YTM, Convexity & DV01"
            >
              <ShieldCheck className="w-3 h-3 text-indigo-400" />
              <span>Risk &amp; Duration</span>
            </button>
          </div>

          {/* Asset Class Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 overflow-x-auto">
            {assetClasses.map((ac) => (
              <button
                key={ac.value}
                onClick={() => setSelectedAssetClass(ac.value)}
                className={`px-2 py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 text-[10px] ${
                  selectedAssetClass === ac.value
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ac.label}
              </button>
            ))}
          </div>

          {/* Currency Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {['ALL', ...Array.from(new Set(positions.map((p) => p.instrument.currency)))].map((ccy) => (
              <button
                key={ccy}
                onClick={() => setSelectedCurrency(ccy)}
                className={`px-1.5 py-0.5 rounded font-mono font-medium transition-colors whitespace-nowrap shrink-0 text-[10px] ${
                  selectedCurrency === ccy
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ccy}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance & Cost P/L KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-3 bg-slate-950/80 border-b border-slate-800 text-xs">
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Holdings Cost Basis</span>
            <span className="text-[9px] text-slate-500 font-sans">Book Value</span>
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 mt-1">
            {formatNumber(totalCost, 0)} <span className="text-[10px] text-slate-500 font-normal">{baseCurrency}</span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Total Unrealized Cost P/L</span>
            <span className="text-[9px] text-slate-500 font-sans">MV vs Cost</span>
          </div>
          <div className={`text-sm font-bold font-mono mt-1 flex items-center gap-2 ${isPortfolioProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>{isPortfolioProfitable ? '+' : ''}{formatNumber(totalPnL, 0)} {baseCurrency}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              isPortfolioProfitable
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                : 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
            }`}>
              {isPortfolioProfitable ? '+' : ''}{totalPnLPct.toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Holdings YTD Return</span>
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Year-to-Date</span>
          </div>
          <div className={`text-sm font-bold font-mono mt-1 flex items-center gap-1.5 ${portfolioYtdPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>{portfolioYtdPct >= 0 ? '+' : ''}{portfolioYtdPct.toFixed(2)}%</span>
            {portfolioReturns?.ytd && (
              <span className="text-[10px] font-normal text-slate-400">
                ({portfolioReturns.ytd.totalReturnDollar >= 0 ? '+' : ''}{formatNumber(portfolioReturns.ytd.totalReturnDollar, 0)} {baseCurrency})
              </span>
            )}
          </div>
        </div>

        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span>Holdings MTD Return</span>
            </span>
            <span className="text-[9px] text-slate-500 font-sans">Month-to-Date</span>
          </div>
          <div className={`text-sm font-bold font-mono mt-1 flex items-center gap-1.5 ${portfolioMtdPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            <span>{portfolioMtdPct >= 0 ? '+' : ''}{portfolioMtdPct.toFixed(2)}%</span>
            {portfolioReturns?.mtd && (
              <span className="text-[10px] font-normal text-slate-400">
                ({portfolioReturns.mtd.totalReturnDollar >= 0 ? '+' : ''}{formatNumber(portfolioReturns.mtd.totalReturnDollar, 0)} {baseCurrency})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* High-Density Financial Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
              <th className="py-2.5 px-3 w-8"></th>
              <th
                onClick={() => handleSort('isin')}
                className="py-2.5 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center gap-1">
                  <span>SECURITY / ISSUER</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th className="py-2.5 px-2">ASSET TYPE</th>
              {viewMode !== 'performance' && <th className="py-2.5 px-2">RATING</th>}
              <th className="py-2.5 px-2">CCY</th>
              <th
                onClick={() => handleSort('quantity')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>POSITION (PAR/QTY)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-600" />
                </div>
              </th>
              <th
                onClick={() => handleSort('cleanPrice')}
                className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-200"
              >
                CLEAN PX
              </th>
              {viewMode === 'risk' && <th className="py-2.5 px-2 text-right">ACCRUED</th>}
              {viewMode !== 'performance' && <th className="py-2.5 px-2 text-right">DIRTY PX</th>}

              {/* Market Value in Base CCY */}
              <th
                onClick={() => handleSort('marketValueBase')}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center justify-end gap-1 text-slate-200">
                  <span>MARKET VAL ({baseCurrency})</span>
                  <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                </div>
              </th>

              {/* Book Cost Column (Shown in Performance View) */}
              {viewMode === 'performance' && (
                <th
                  onClick={() => handleSort('costBasis')}
                  className="py-2.5 px-2.5 text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>BOOK COST</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
              )}

              {/* Cost P/L Column (Shown in All and Performance views) */}
              {viewMode !== 'risk' && (
                <th
                  onClick={() => handleSort('unrealizedPnLBase')}
                  className="py-2.5 px-3 text-right cursor-pointer hover:text-emerald-300"
                >
                  <div className="flex items-center justify-end gap-1 text-emerald-400 font-semibold">
                    <span>COST P/L ({baseCurrency})</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-500" />
                  </div>
                </th>
              )}

              {/* YTD Performance Return */}
              {viewMode !== 'risk' && (
                <th
                  onClick={() => handleSort('ytdReturnPct')}
                  className="py-2.5 px-2.5 text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>YTD RET</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
              )}

              {/* MTD Performance Return */}
              {viewMode !== 'risk' && (
                <th
                  onClick={() => handleSort('mtdReturnPct')}
                  className="py-2.5 px-2.5 text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>MTD RET</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
              )}

              {/* Portfolio Weight */}
              <th
                onClick={() => handleSort('portfolioWeight')}
                className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-200"
              >
                WEIGHT
              </th>

              {/* Risk Analytics Columns */}
              {viewMode !== 'performance' && (
                <>
                  <th
                    onClick={() => handleSort('ytm')}
                    className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-200"
                  >
                    YTM
                  </th>
                  <th
                    onClick={() => handleSort('modifiedDuration')}
                    className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-200"
                  >
                    MOD DUR
                  </th>
                  {viewMode === 'risk' && (
                    <th
                      onClick={() => handleSort('convexity')}
                      className="py-2.5 px-2 text-right cursor-pointer hover:text-slate-200"
                    >
                      CONVEXITY
                    </th>
                  )}
                  <th
                    onClick={() => handleSort('dv01Base')}
                    className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-200"
                  >
                    DV01 ({baseCurrency})
                  </th>
                </>
              )}

              <th className="py-2.5 px-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {sorted.map((pos) => {
              const isExpanded = expandedIsin === pos.isin;
              const isProfit = pos.unrealizedPnLBase >= 0;
              const ytdPos = (pos.ytdReturnPct || 0) >= 0;
              const mtdPos = (pos.mtdReturnPct || 0) >= 0;

              return (
                <React.Fragment key={pos.isin}>
                  <tr
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isExpanded ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => setExpandedIsin(isExpanded ? null : pos.isin)}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>

                    {/* Security & Issuer */}
                    <td className="py-2 px-3">
                      <div className="font-sans font-semibold text-slate-100 flex items-center gap-1.5">
                        <span
                          onClick={() => onSelectInstrument(pos.instrument)}
                          className="hover:underline hover:text-indigo-400 cursor-pointer text-xs"
                        >
                          {pos.instrument.name}
                        </span>
                        {pos.pricingMissing && (
                          <span
                            title="Missing market clean price. Book cost price used as fallback."
                            className="text-amber-400"
                          >
                            <AlertCircle className="w-3 h-3 inline" />
                          </span>
                        )}
                        {pos.illiquidFlag && (
                          <span
                            title="Illiquid private placement note"
                            className="text-[9px] font-mono text-purple-400 border border-purple-500/40 px-1 rounded"
                          >
                            ILLIQ
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{pos.isin}</span>
                        <span>·</span>
                        <span>{pos.instrument.issuer}</span>
                      </div>
                    </td>

                    {/* Asset Type */}
                    <td className="py-2 px-2 text-slate-300 font-sans text-[11px]">
                      {pos.instrument.assetClass === 'DirectBond' && 'Direct Bond'}
                      {pos.instrument.assetClass === 'MutualFund' && 'Mutual Fund'}
                      {pos.instrument.assetClass === 'CapFloorFloater' && 'Cap-Floor Floater'}
                      {pos.instrument.assetClass === 'BondLinkedNote' && 'Bond-Linked Note'}
                      {pos.instrument.assetClass === 'PrivatePlacement' && 'Private Note'}
                    </td>

                    {/* Rating */}
                    {viewMode !== 'performance' && (
                      <td className="py-2 px-2">
                        <span className="text-slate-300 font-mono">{pos.instrument.creditRating}</span>
                      </td>
                    )}

                    {/* CCY */}
                    <td className="py-2 px-2 font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        pos.instrument.currency === baseCurrency
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                      }`}>
                        {pos.instrument.currency}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                      <div>{formatNumber(pos.quantity, 0)}</div>
                      <div className="text-[10px] text-slate-500 font-sans">{pos.instrument.currency} par</div>
                    </td>

                    {/* Clean Price */}
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-300">
                      {formatNumber(pos.cleanPrice, 3)}
                    </td>

                    {/* Accrued Interest */}
                    {viewMode === 'risk' && (
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-400">
                        {formatNumber(pos.accruedInterestPct, 3)}
                      </td>
                    )}

                    {/* Dirty Price */}
                    {viewMode !== 'performance' && (
                      <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-200 font-medium">
                        {formatNumber(pos.dirtyPrice, 3)}
                      </td>
                    )}

                    {/* Market Value in Base CCY */}
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      <div className="font-semibold text-white">
                        {formatNumber(pos.marketValueBase, 0)}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">{baseCurrency}</span>
                      </div>
                      {pos.instrument.currency !== baseCurrency && (
                        <div className="text-[10px] text-indigo-300 font-mono">
                          {formatNumber(pos.marketValueLocal, 0)} {pos.instrument.currency}
                          <span className="text-slate-500 text-[9px] ml-1">
                            (@{pos.fxToBase < 0.01 ? pos.fxToBase.toFixed(5) : pos.fxToBase.toFixed(4)})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Book Cost (Performance View) */}
                    {viewMode === 'performance' && (
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-300">
                        <div>{formatNumber(pos.costBasis, 0)}</div>
                        <div className="text-[10px] text-slate-500">@{formatNumber(pos.costPrice, 3)}</div>
                      </td>
                    )}

                    {/* Cost P/L ($ and %) */}
                    {viewMode !== 'risk' && (
                      <td className="py-2 px-3 text-right font-mono tabular-nums">
                        <div className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}{formatNumber(pos.unrealizedPnLBase, 0)}
                        </div>
                        <div className={`text-[10px] font-medium ${isProfit ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
                          {isProfit ? '+' : ''}{pos.costPnLPct.toFixed(2)}%
                        </div>
                      </td>
                    )}

                    {/* YTD Return % */}
                    {viewMode !== 'risk' && (
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          ytdPos
                            ? 'text-emerald-300 bg-emerald-950/60 border border-emerald-800/50'
                            : 'text-rose-300 bg-rose-950/60 border border-rose-800/50'
                        }`}>
                          {ytdPos ? '+' : ''}{(pos.ytdReturnPct || 0).toFixed(2)}%
                        </span>
                      </td>
                    )}

                    {/* MTD Return % */}
                    {viewMode !== 'risk' && (
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          mtdPos
                            ? 'text-emerald-300 bg-emerald-950/60 border border-emerald-800/50'
                            : 'text-rose-300 bg-rose-950/60 border border-rose-800/50'
                        }`}>
                          {mtdPos ? '+' : ''}{(pos.mtdReturnPct || 0).toFixed(2)}%
                        </span>
                      </td>
                    )}

                    {/* Weight */}
                    <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-300">
                      {formatNumber(pos.portfolioWeight, 2)}%
                    </td>

                    {/* Risk Columns */}
                    {viewMode !== 'performance' && (
                      <>
                        {/* YTM */}
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-indigo-300 font-medium">
                          {formatNumber(pos.ytm * 100, 2)}%
                        </td>

                        {/* Modified Duration */}
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-300">
                          {formatNumber(pos.modifiedDuration, 2)}y
                        </td>

                        {/* Convexity */}
                        {viewMode === 'risk' && (
                          <td className="py-2 px-2 text-right font-mono tabular-nums text-slate-400">
                            {formatNumber(pos.convexity, 3)}
                          </td>
                        )}

                        {/* DV01 Base & Local */}
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          <div className="text-emerald-400 font-semibold">
                            ${formatNumber(pos.dv01Base, 1)}
                          </div>
                          {pos.instrument.currency !== baseCurrency && (
                            <div className="text-[10px] text-slate-400">
                              loc: {formatNumber(pos.dv01Local, 1)} {pos.instrument.currency}
                            </div>
                          )}
                        </td>
                      </>
                    )}

                    {/* Quick Trade / Action */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        <button
                          onClick={() => onTradeInstrument(pos.isin, 'SELL')}
                          className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-colors"
                          title="Record Sell Transaction"
                        >
                          Sell
                        </button>
                        <button
                          onClick={() => onTradeInstrument(pos.isin, 'BUY')}
                          className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors"
                          title="Record Additional Buy"
                        >
                          Buy
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Detail Drawer */}
                  {isExpanded && (
                    <tr className="bg-slate-950/70 border-b border-slate-800">
                      <td colSpan={20} className="py-3 px-6 font-sans text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-1 text-slate-300">
                          {/* Col 1: Terms & Day Count */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-mono text-slate-500 font-medium">
                              Convention &amp; Schedule
                            </div>
                            <div className="text-slate-200 font-mono text-[11px]">
                              Day Count: {('dayCount' in pos.instrument && pos.instrument.dayCount) || 'N/A'}
                            </div>
                            <div className="text-slate-300 text-[11px]">
                              Frequency: {('couponFrequency' in pos.instrument && `${pos.instrument.couponFrequency}x/year`) ||
                                ('resetFrequency' in pos.instrument && `${pos.instrument.resetFrequency}x/year`) || 'N/A'}
                            </div>
                            <div className="text-slate-400 text-[11px]">
                              Maturity: {('maturityDate' in pos.instrument && pos.instrument.maturityDate) ||
                                ('expiryDate' in pos.instrument && pos.instrument.expiryDate) || 'Perpetual / N/A'}
                            </div>
                          </div>

                          {/* Col 2: Cost Basis & Cost P/L */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-mono text-slate-500 font-medium flex items-center justify-between">
                              <span>Book Basis &amp; Cost P/L</span>
                              <span className="text-indigo-400 font-mono text-[9px]">WAC BASIS</span>
                            </div>
                            <div className="font-mono text-[11px] text-slate-300">
                              Clean Cost Price: {formatNumber(pos.costPrice, 3)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-300">
                              Local Cost: {formatNumber(pos.costBasis / (pos.fxToBase || 1), 0)} {pos.instrument.currency}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              Base Cost: {formatNumber(pos.costBasis, 0)} {baseCurrency}
                            </div>
                            <div className={`font-mono text-[11px] font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              Unrealized Cost P/L: {isProfit ? '+' : ''}{formatNumber(pos.unrealizedPnLBase, 0)} {baseCurrency} ({isProfit ? '+' : ''}{pos.costPnLPct.toFixed(2)}%)
                            </div>
                            {pos.instrument.currency !== baseCurrency && (
                              <div className="font-mono text-[10px] text-indigo-400">
                                FX Spot: 1 {pos.instrument.currency} = {pos.fxToBase < 0.01 ? pos.fxToBase.toFixed(5) : pos.fxToBase.toFixed(4)} {baseCurrency}
                              </div>
                            )}
                          </div>

                          {/* Col 3: Period Performance & Attribution */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-mono text-slate-500 font-medium flex items-center justify-between">
                              <span>Period Returns (YTD / MTD)</span>
                              <span className="text-emerald-400 font-mono text-[9px]">TOTAL RETURN</span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-slate-400">YTD Return:</span>
                              <span className={`font-bold ${ytdPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {ytdPos ? '+' : ''}{(pos.ytdReturnPct || 0).toFixed(2)}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <span className="text-slate-400">MTD Return:</span>
                              <span className={`font-bold ${mtdPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {mtdPos ? '+' : ''}{(pos.mtdReturnPct || 0).toFixed(2)}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 pt-1">
                              Portfolio Weight: <span className="text-slate-200 font-mono font-semibold">{formatNumber(pos.portfolioWeight, 2)}%</span>
                            </div>
                          </div>

                          {/* Col 4: Structured Terms / Next Cash Flow */}
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase font-mono text-slate-500 font-medium">
                              Cash Flow / Structured Terms
                            </div>
                            {pos.instrument.assetClass === 'CapFloorFloater' && (
                              <div className="text-[11px] text-slate-300">
                                Collar: Floor {(pos.instrument.floorLevel * 100).toFixed(2)}% · Cap {(pos.instrument.capLevel * 100).toFixed(2)}% · Margin +{pos.instrument.marginBps}bps
                              </div>
                            )}
                            {pos.instrument.assetClass === 'BondLinkedNote' && (
                              <div className="text-[11px] text-slate-300">
                                Strike {pos.instrument.strikePricePct}% · Barrier {pos.instrument.barrierLevelPct}% · Coupon {(pos.instrument.guaranteedCouponRate * 100).toFixed(2)}%
                              </div>
                            )}
                            {pos.nextCouponDate && (
                              <div className="font-mono text-[11px] text-indigo-300">
                                Next Coupon: {pos.nextCouponDate} ({formatNumber(pos.nextCouponAmount || 0, 0)} {pos.instrument.currency})
                              </div>
                            )}
                            <button
                              onClick={() => onSelectInstrument(pos.instrument)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
                            >
                              <span>View Full Specifications &amp; Cash Flows</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={20} className="py-12 text-center text-slate-500 font-sans">
                  No active holdings found matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary Row */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div>
          Showing <span className="text-white font-semibold">{sorted.length}</span> of {positions.length} active positions
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            Total Cost:{' '}
            <span className="text-slate-200 font-bold">
              {formatNumber(totalCost, 0)} {baseCurrency}
            </span>
          </div>
          <div>
            Total Holdings MV:{' '}
            <span className="text-white font-bold">
              {formatNumber(totalMv, 0)} {baseCurrency}
            </span>
          </div>
          <div>
            Total Cost P/L:{' '}
            <span className={`font-bold ${isPortfolioProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPortfolioProfitable ? '+' : ''}{formatNumber(totalPnL, 0)} {baseCurrency} ({isPortfolioProfitable ? '+' : ''}{totalPnLPct.toFixed(2)}%)
            </span>
          </div>
          <div>
            Total DV01:{' '}
            <span className="text-emerald-400 font-bold">
              ${formatNumber(positions.reduce((s, p) => s + p.dv01Base, 0), 1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
