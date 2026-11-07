/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Currency,
  FloatingRateResetEvent,
} from '../types/portfolio';
import {
  Clock,
  Sliders,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

interface FloatingRateScheduleViewProps {
  resets: FloatingRateResetEvent[];
  baseCurrency: Currency;
}

export const FloatingRateScheduleView: React.FC<FloatingRateScheduleViewProps> = ({
  resets,
  baseCurrency,
}) => {
  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="space-y-4">
      {/* Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">
              Floating-Rate Reset Calendar & Collar Monitor
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tracking benchmark fixings, collar boundaries (cap & floor), and coupon projections for variable-rate instruments and private placements.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
          <span className="text-indigo-400 font-bold">{resets.length}</span> Active Floaters
        </div>
      </div>

      {/* Main Resets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                <th className="py-2.5 px-4">INSTRUMENT / ISIN</th>
                <th className="py-2.5 px-3">BENCHMARK</th>
                <th className="py-2.5 px-3 text-right">SPREAD</th>
                <th className="py-2.5 px-3 text-center">COLLAR BOUNDS</th>
                <th className="py-2.5 px-3 text-right">CURRENT FIXING</th>
                <th className="py-2.5 px-3 text-right">CURRENT COUPON</th>
                <th className="py-2.5 px-3">NEXT RESET DATE</th>
                <th className="py-2.5 px-3 text-right">DAYS TO RESET</th>
                <th className="py-2.5 px-4 text-right">EST. COUPON FLOW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {resets.map((r) => {
                const isCapped = r.currentCouponRate >= r.capLevel;
                const isFloored = r.currentCouponRate <= r.floorLevel;
                const isUrgent = r.daysToReset <= 30;

                return (
                  <tr key={r.isin} className="hover:bg-slate-800/40 transition-colors">
                    {/* Instrument */}
                    <td className="py-3 px-4">
                      <div className="font-sans font-semibold text-slate-100 text-xs">
                        {r.instrumentName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {r.isin} · Par: {formatNumber(r.notional, 0)} {r.currency}
                      </div>
                    </td>

                    {/* Benchmark */}
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 bg-slate-800 text-indigo-300 rounded font-mono text-[10px]">
                        {r.referenceRate}
                      </span>
                    </td>

                    {/* Spread */}
                    <td className="py-3 px-3 text-right font-mono text-slate-200">
                      +{r.marginBps} bps
                    </td>

                    {/* Collar Bounds */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5 text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        <span className="text-slate-400">Floor:</span>
                        <span className="text-emerald-400 font-bold">{(r.floorLevel * 100).toFixed(2)}%</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-slate-400">Cap:</span>
                        <span className="text-rose-400 font-bold">{(r.capLevel * 100).toFixed(2)}%</span>
                      </div>
                      {isCapped && (
                        <div className="text-[9px] text-rose-400 font-sans mt-0.5">
                          Cap Active (Capped)
                        </div>
                      )}
                      {isFloored && (
                        <div className="text-[9px] text-emerald-400 font-sans mt-0.5">
                          Floor Active (Guaranteed)
                        </div>
                      )}
                    </td>

                    {/* Current Fixing */}
                    <td className="py-3 px-3 text-right text-slate-300">
                      {(r.currentFixing * 100).toFixed(2)}%
                    </td>

                    {/* Current Coupon */}
                    <td className="py-3 px-3 text-right font-bold text-white">
                      {(r.currentCouponRate * 100).toFixed(2)}%
                    </td>

                    {/* Next Reset Date */}
                    <td className="py-3 px-3 font-mono text-indigo-300">
                      {r.nextResetDate}
                    </td>

                    {/* Days to Reset */}
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                          isUrgent
                            ? 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                            : 'text-slate-400'
                        }`}
                      >
                        {r.daysToReset > 0 ? `${r.daysToReset} days` : 'Past Due / Fix Today'}
                      </span>
                    </td>

                    {/* Estimated Coupon Cash Inflow */}
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {formatNumber(r.estimatedNextCoupon, 0)} {r.currency}
                    </td>
                  </tr>
                );
              })}

              {resets.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    No active floating-rate instruments or upcoming resets in the current portfolio.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
