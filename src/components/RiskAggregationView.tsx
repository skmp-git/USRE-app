/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  RiskAggregation,
} from '../types/portfolio';
import {
  PieChart,
  Shield,
  Building2,
  Coins,
  Layers,
  ChevronRight,
} from 'lucide-react';

interface RiskAggregationViewProps {
  breakdowns: {
    bySector: RiskAggregation[];
    byRating: RiskAggregation[];
    byCounterparty: RiskAggregation[];
    byCurrency: RiskAggregation[];
    byAssetClass: RiskAggregation[];
    byPaymentRank: RiskAggregation[];
  };
  baseCurrency: Currency;
  totalPortfolioValue: number;
}

export const RiskAggregationView: React.FC<RiskAggregationViewProps> = ({
  breakdowns,
  baseCurrency,
  totalPortfolioValue,
}) => {
  const [activeGrouping, setActiveGrouping] = useState<
    'sector' | 'rating' | 'counterparty' | 'currency' | 'assetClass' | 'paymentRank'
  >('sector');

  const groupings = [
    { id: 'sector', label: 'Sector Exposure', icon: Building2, data: breakdowns.bySector },
    { id: 'rating', label: 'Credit Rating', icon: Shield, data: breakdowns.byRating },
    { id: 'paymentRank', label: 'Payment Rank / Seniority', icon: Layers, data: breakdowns.byPaymentRank },
    { id: 'counterparty', label: 'Issuer Concentration', icon: Building2, data: breakdowns.byCounterparty },
    { id: 'currency', label: 'Currency Allocation', icon: Coins, data: breakdowns.byCurrency },
    { id: 'assetClass', label: 'Asset Class Split', icon: PieChart, data: breakdowns.byAssetClass },
  ];

  const currentData = breakdowns[
    activeGrouping === 'sector'
      ? 'bySector'
      : activeGrouping === 'rating'
      ? 'byRating'
      : activeGrouping === 'paymentRank'
      ? 'byPaymentRank'
      : activeGrouping === 'counterparty'
      ? 'byCounterparty'
      : activeGrouping === 'currency'
      ? 'byCurrency'
      : 'byAssetClass'
  ];

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="space-y-4">
      {/* Grouping Tab Selector */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
        {groupings.map((g) => {
          const Icon = g.icon;
          const isActive = activeGrouping === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGrouping(g.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{g.label}</span>
              <span className="font-mono text-[10px] opacity-75">
                ({g.data.length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Aggregation Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {groupings.find((g) => g.id === activeGrouping)?.label} Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Aggregated portfolio exposures, duration weights, and interest rate sensitivity (DV01) in {baseCurrency}
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Portfolio Total: <span className="text-white font-bold">{formatNumber(totalPortfolioValue, 0)} {baseCurrency}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                <th className="py-2.5 px-4">CATEGORY / SLICE</th>
                <th className="py-2.5 px-3 text-right">MARKET VALUE ({baseCurrency})</th>
                <th className="py-2.5 px-3 w-48">PORTFOLIO WEIGHT</th>
                <th className="py-2.5 px-3 text-right">WEIGHTED MOD DUR</th>
                <th className="py-2.5 px-3 text-right">WEIGHTED YTM</th>
                <th className="py-2.5 px-4 text-right">TOTAL DV01 ({baseCurrency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {currentData.map((row, idx) => {
                const barWidth = Math.min(100, Math.max(2, row.portfolioWeight));

                return (
                  <tr key={row.category || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-mono text-[10px] w-5">
                          #{idx + 1}
                        </span>
                        {activeGrouping === 'currency' ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700/60 font-mono font-bold text-indigo-300">
                            {row.category}
                          </span>
                        ) : (
                          <span>{row.category}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-white">
                      {formatNumber(row.marketValue, 0)}
                    </td>

                    {/* Proportional visual bar */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-slate-300 w-12 text-right">
                          {formatNumber(row.portfolioWeight, 1)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-300">
                      {formatNumber(row.weightedDuration, 2)} yrs
                    </td>

                    <td className="py-2.5 px-3 text-right tabular-nums text-indigo-300 font-medium">
                      {formatNumber(row.weightedYtm * 100, 2)}%
                    </td>

                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-400">
                      ${formatNumber(row.dv01, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid of 2 Summary Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Credit Quality Concentration */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Credit Quality & Seniority Profile
            </h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Investment Grade (AAA to BBB-) represents the core mandate allocation, providing stable liability matching. High Yield and illiquid structured notes offer yield enhancement with capped tail risk.
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Total IG Proportion:</span>
            <span className="text-emerald-400 font-bold">
              {(
                breakdowns.byRating
                  .filter((r) => ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-'].includes(r.category))
                  .reduce((s, r) => s + r.portfolioWeight, 0)
              ).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Interest Rate Risk Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-indigo-400" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Aggregate DV01 Sensitivity
            </h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            A 1 basis point (+0.01%) parallel upward shift in global yields results in an estimated aggregate portfolio mark-to-market loss of approximately{' '}
            <span className="text-rose-400 font-mono font-semibold">
              -${formatNumber(breakdowns.bySector.reduce((s, r) => s + r.dv01, 0), 1)} {baseCurrency}
            </span>.
          </p>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">Floater Duration Hedge:</span>
            <span className="text-indigo-400 font-bold">Active Collars</span>
          </div>
        </div>
      </div>
    </div>
  );
};
