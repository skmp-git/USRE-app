/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Currency,
  Instrument,
  DirectBond,
  CapFloorFloater,
  BondLinkedNote,
  PrivatePlacementNote,
  MutualFund,
} from '../types/portfolio';
import {
  generateCashFlows,
  calculateYearFraction,
} from '../services/quantitativeEngine';
import {
  X,
  FileText,
  Calendar,
  Layers,
  Shield,
  Coins,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface InstrumentDetailModalProps {
  instrument: Instrument | null;
  onClose: () => void;
  valuationDate: string;
  onTradeClick: (isin: string, type: 'BUY' | 'SELL') => void;
}

export const InstrumentDetailModal: React.FC<InstrumentDetailModalProps> = ({
  instrument,
  onClose,
  valuationDate,
  onTradeClick,
}) => {
  if (!instrument) return null;

  // Generate cash flow schedule if applicable
  let cashFlows: any[] = [];
  if (instrument.assetClass === 'DirectBond') {
    const bond = instrument as DirectBond;
    cashFlows = generateCashFlows(
      bond.maturityDate,
      valuationDate,
      bond.couponRate,
      bond.couponFrequency,
      bond.dayCount,
      bond.amortizationFactor || 1.0
    );
  } else if (instrument.assetClass === 'PrivatePlacement') {
    const note = instrument as PrivatePlacementNote;
    const rate = note.fixedCouponRate || 0.05;
    cashFlows = generateCashFlows(
      note.maturityDate,
      valuationDate,
      rate,
      note.couponFrequency,
      note.dayCount
    );
  }

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">
              Instrument Master Specifications
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Main Title & Attributes */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white font-sans">
                  {instrument.name}
                </h2>
                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-1">
                  <span>ISIN: {instrument.isin}</span>
                  <span>·</span>
                  <span>Issuer: {instrument.issuer}</span>
                  <span>·</span>
                  <span>Currency: {instrument.currency}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] font-bold">
                  {instrument.creditRating}
                </span>
                <span className="px-2.5 py-1 rounded bg-indigo-950 border border-indigo-800/80 text-indigo-300 text-[11px] font-semibold">
                  {instrument.assetClass}
                </span>
              </div>
            </div>

            {instrument.description && (
              <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-800/80 leading-relaxed">
                {instrument.description}
              </p>
            )}
          </div>

          {/* Asset-Specific Technical Attributes Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Sector</div>
              <div className="font-semibold text-slate-200 mt-0.5">{instrument.sector}</div>
            </div>

            {/* Direct Bond Attributes */}
            {instrument.assetClass === 'DirectBond' && (
              <>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Maturity Date</div>
                  <div className="font-mono text-slate-200 font-bold mt-0.5">{instrument.maturityDate}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Coupon Rate</div>
                  <div className="font-mono text-indigo-300 font-bold mt-0.5">
                    {(instrument.couponRate * 100).toFixed(3)}%
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Day Count Convention</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.dayCount}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Coupon Frequency</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.couponFrequency}x / year</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Amortization / Call</div>
                  <div className="text-slate-200 mt-0.5 font-sans">
                    {instrument.callable ? 'Callable Tier-2' : 'Bullet Redemption'}
                  </div>
                </div>
              </>
            )}

            {/* Mutual Fund Attributes */}
            {instrument.assetClass === 'MutualFund' && (
              <>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Ticker</div>
                  <div className="font-mono text-slate-200 font-bold mt-0.5">{instrument.ticker}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Fund Manager</div>
                  <div className="text-slate-200 font-sans mt-0.5">{instrument.fundManager}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Dividend Policy</div>
                  <div className="font-sans text-indigo-300 font-medium mt-0.5">{instrument.dividendPolicy}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Reported Duration</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.effectiveDuration} yrs</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Expense Ratio</div>
                  <div className="font-mono text-slate-200 mt-0.5">
                    {instrument.expenseRatio ? `${(instrument.expenseRatio * 100).toFixed(2)}%` : '—'}
                  </div>
                </div>
              </>
            )}

            {/* Cap-Floor Floater Attributes */}
            {instrument.assetClass === 'CapFloorFloater' && (
              <>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Reference Rate</div>
                  <div className="font-mono text-indigo-300 font-bold mt-0.5">{instrument.referenceRate}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Margin / Spread</div>
                  <div className="font-mono text-slate-200 font-bold mt-0.5">+{instrument.marginBps} bps</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Collar Cap Level</div>
                  <div className="font-mono text-rose-300 font-bold mt-0.5">{(instrument.capLevel * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Collar Floor Level</div>
                  <div className="font-mono text-emerald-300 font-bold mt-0.5">{(instrument.floorLevel * 100).toFixed(2)}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Next Reset Date</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.nextResetDate}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Day Count</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.dayCount}</div>
                </div>
              </>
            )}

            {/* Bond-Linked Note Attributes */}
            {instrument.assetClass === 'BondLinkedNote' && (
              <>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Underlying Asset</div>
                  <div className="text-slate-200 truncate mt-0.5" title={instrument.underlyingBondName}>
                    {instrument.underlyingBondName}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Strike Price</div>
                  <div className="font-mono text-slate-200 font-bold mt-0.5">{instrument.strikePricePct}%</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Barrier Level</div>
                  <div className="font-mono text-amber-300 font-bold mt-0.5">
                    {instrument.barrierLevelPct ? `${instrument.barrierLevelPct}%` : 'None'}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Guaranteed Coupon</div>
                  <div className="font-mono text-emerald-300 font-bold mt-0.5">
                    {(instrument.guaranteedCouponRate * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Expiry Date</div>
                  <div className="font-mono text-slate-200 mt-0.5">{instrument.expiryDate}</div>
                </div>
              </>
            )}

            {/* Private Placement Attributes */}
            {instrument.assetClass === 'PrivatePlacement' && (
              <>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Maturity Date</div>
                  <div className="font-mono text-slate-200 font-bold mt-0.5">{instrument.maturityDate}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Seniority</div>
                  <div className="text-slate-200 font-sans mt-0.5">{instrument.seniority}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Jurisdiction</div>
                  <div className="text-slate-200 font-sans mt-0.5">{instrument.jurisdiction}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Valuation Flag</div>
                  <div className="font-mono text-purple-300 font-bold mt-0.5">
                    {instrument.illiquidValuationFlag ? 'Illiquid Model-Priced' : 'Liquid'}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cash Flow Schedule Table if available */}
          {cashFlows.length > 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300">
                  Projected Cash Flow Ladder (Per 100 Par) from Valuation Date ({valuationDate})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {cashFlows.length} Payment Periods Remaining
                </span>
              </div>

              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800">
                      <th className="py-2 px-3">PERIOD DATE</th>
                      <th className="py-2 px-3 text-right">YEAR FRACTION (T)</th>
                      <th className="py-2 px-3 text-right">COUPON FLOW</th>
                      <th className="py-2 px-3 text-right">PRINCIPAL</th>
                      <th className="py-2 px-3 text-right">TOTAL FLOW</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {cashFlows.map((cf, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-1.5 px-3 text-slate-200">{cf.date}</td>
                        <td className="py-1.5 px-3 text-right text-slate-400">{cf.yearFraction.toFixed(4)}y</td>
                        <td className="py-1.5 px-3 text-right text-indigo-300 font-medium">{formatNumber(cf.amount, 3)}</td>
                        <td className="py-1.5 px-3 text-right text-slate-300">{formatNumber(cf.principal, 2)}</td>
                        <td className="py-1.5 px-3 text-right text-white font-bold">{formatNumber(cf.total, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950 shrink-0">
          <div className="text-[11px] font-mono text-slate-500">
            ISIN: {instrument.isin}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onTradeClick(instrument.isin, 'SELL');
              }}
              className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 font-medium text-xs transition-colors"
            >
              Sell Instrument
            </button>
            <button
              onClick={() => {
                onClose();
                onTradeClick(instrument.isin, 'BUY');
              }}
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors shadow-xs"
            >
              Buy More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
