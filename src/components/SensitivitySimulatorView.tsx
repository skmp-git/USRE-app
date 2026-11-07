/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  PositionValuation,
} from '../types/portfolio';
import {
  Activity,
  Zap,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';

interface SensitivitySimulatorViewProps {
  positions: PositionValuation[];
  totalHoldingsValue: number;
  weightedDuration: number;
  weightedConvexity: number;
  totalDv01: number;
  baseCurrency: Currency;
}

export const SensitivitySimulatorView: React.FC<SensitivitySimulatorViewProps> = ({
  positions,
  totalHoldingsValue,
  weightedDuration,
  weightedConvexity,
  totalDv01,
  baseCurrency,
}) => {
  const [shiftBps, setShiftBps] = useState<number>(50); // Default +50 bps shock

  const deltaY = shiftBps / 10000; // e.g. 0.0050 for 50 bps

  // Portfolio level Taylor series expansion:
  // dP/P = - ModD * dy + 0.5 * Convexity * (dy)^2
  const portfolioPctChange = -weightedDuration * deltaY + 0.5 * weightedConvexity * Math.pow(deltaY, 2);
  const portfolioDollarImpact = totalHoldingsValue * portfolioPctChange;

  const presets = [-100, -50, -25, +25, +50, +100, +200];

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="space-y-4">
      {/* Scenario Control Panel */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">
                Interest Rate Sensitivity & Scenario Stress Tester
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulate instantaneous parallel yield curve shifts using second-order Taylor expansion (Duration + Convexity).
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-500 px-2">Presets:</span>
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setShiftBps(p)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                  shiftBps === p
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {p > 0 ? `+${p}` : p} bps
              </button>
            ))}
          </div>
        </div>

        {/* Slider & Value Display */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Parallel Yield Shift:
            </span>
            <span className={`font-bold text-sm ${shiftBps > 0 ? 'text-amber-400' : shiftBps < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {shiftBps > 0 ? `+${shiftBps}` : shiftBps} bps ({(deltaY * 100).toFixed(2)}%)
            </span>
          </div>

          <input
            type="range"
            min="-200"
            max="200"
            step="5"
            value={shiftBps}
            onChange={(e) => setShiftBps(parseInt(e.target.value, 10))}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-600">
            <span>-200 bps (Dovish Easing)</span>
            <span>0 bps (Current)</span>
            <span>+200 bps (Hawkish Tightening)</span>
          </div>
        </div>

        {/* Projected Impact Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-mono">ESTIMATED P&L IMPACT</div>
            <div className={`text-lg font-bold font-mono mt-1 ${portfolioDollarImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {portfolioDollarImpact >= 0 ? '+' : ''}{formatNumber(portfolioDollarImpact, 0)} {baseCurrency}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
              Mark-to-market shift
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-mono">PERCENTAGE VALUE SHIFT</div>
            <div className={`text-lg font-bold font-mono mt-1 ${portfolioPctChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {portfolioPctChange >= 0 ? '+' : ''}{(portfolioPctChange * 100).toFixed(2)}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
              Holding return
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-mono">PORTFOLIO MOD DURATION</div>
            <div className="text-lg font-bold font-mono text-white mt-1">
              {weightedDuration.toFixed(2)} yrs
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
              First-order rate sensitivity
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800/80">
            <div className="text-[11px] text-slate-400 font-mono">PORTFOLIO CONVEXITY</div>
            <div className="text-lg font-bold font-mono text-indigo-300 mt-1">
              {weightedConvexity.toFixed(3)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
              Curvature buffer
            </div>
          </div>
        </div>
      </div>

      {/* Security Level Breakdown of Stress Test */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-white">
            Security-Level Projected Shock Impact ({shiftBps > 0 ? `+${shiftBps}` : shiftBps} bps)
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            Sorted by absolute dollar impact
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                <th className="py-2.5 px-4">SECURITY</th>
                <th className="py-2.5 px-3">ASSET TYPE</th>
                <th className="py-2.5 px-3 text-right">MOD DUR</th>
                <th className="py-2.5 px-3 text-right">CONVEXITY</th>
                <th className="py-2.5 px-3 text-right">CURRENT MV ({baseCurrency})</th>
                <th className="py-2.5 px-3 text-right">% CHANGE</th>
                <th className="py-2.5 px-4 text-right">PROJECTED P&L ({baseCurrency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {[...positions]
                .map((p) => {
                  const pct = -p.modifiedDuration * deltaY + 0.5 * p.convexity * Math.pow(deltaY, 2);
                  const dollar = p.marketValueBase * pct;
                  return { ...p, projectedPct: pct, projectedDollar: dollar };
                })
                .sort((a, b) => Math.abs(b.projectedDollar) - Math.abs(a.projectedDollar))
                .map((pos) => {
                  const isPositive = pos.projectedDollar >= 0;
                  return (
                    <tr key={pos.isin} className="hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-sans font-medium text-slate-200">
                        <div>{pos.instrument.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{pos.isin}</div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{pos.instrument.assetClass}</td>
                      <td className="py-2 px-3 text-right text-slate-300">{pos.modifiedDuration.toFixed(2)}y</td>
                      <td className="py-2 px-3 text-right text-slate-400">{pos.convexity.toFixed(3)}</td>
                      <td className="py-2 px-3 text-right text-white font-medium">{formatNumber(pos.marketValueBase, 0)}</td>
                      <td className={`py-2 px-3 text-right font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{(pos.projectedPct * 100).toFixed(2)}%
                      </td>
                      <td className={`py-2 px-4 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{formatNumber(pos.projectedDollar, 0)}
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
