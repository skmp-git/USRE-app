/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Currency,
  TransactionType,
  Transaction,
  Instrument,
} from '../types/portfolio';
import {
  calculateAccruedInterest,
  getCouponDates,
  addMonths,
} from '../services/quantitativeEngine';
import { sqliteService } from '../services/sqliteStorage';
import {
  X,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';

interface LogTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
  instruments: Instrument[];
  snapshotDate: string;
  defaultIsin?: string;
  defaultType?: TransactionType;
}

export const LogTransactionModal: React.FC<LogTransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  instruments,
  snapshotDate,
  defaultIsin,
  defaultType = 'BUY',
}) => {
  const [isin, setIsin] = useState<string>(defaultIsin || instruments[0]?.isin || '');
  const [type, setType] = useState<TransactionType>(defaultType);
  const [tradeDate, setTradeDate] = useState<string>('2026-11-02');
  const [settlementDate, setSettlementDate] = useState<string>('2026-11-04');
  const [quantity, setQuantity] = useState<number>(100000);
  const [price, setPrice] = useState<number>(100.0);
  const [fee, setFee] = useState<number>(100);
  const [counterparty, setCounterparty] = useState<string>('Morgan Stanley');
  const [notes, setNotes] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedInst = instruments.find((i) => i.isin === isin);

  // Sync defaults when modal opens or props change
  useEffect(() => {
    if (defaultIsin) setIsin(defaultIsin);
    if (defaultType) setType(defaultType);
  }, [defaultIsin, defaultType, isOpen]);

  // Compute Accrued Interest & Settlement Amounts
  let accruedInterestPct = 0;
  if (selectedInst && ('couponRate' in selectedInst || 'currentCouponRate' in selectedInst)) {
    const rate = 'couponRate' in selectedInst ? selectedInst.couponRate : selectedInst.currentCouponRate;
    const freq = 'couponFrequency' in selectedInst ? selectedInst.couponFrequency : ('resetFrequency' in selectedInst ? selectedInst.resetFrequency : 2);
    const dayCount = selectedInst.dayCount || '30/360';
    let mat = '2030-01-01';
    if ('maturityDate' in selectedInst && selectedInst.maturityDate) {
      mat = String(selectedInst.maturityDate);
    } else if ('expiryDate' in selectedInst && selectedInst.expiryDate) {
      mat = String(selectedInst.expiryDate);
    }
    const { prevCouponDate, nextCouponDate } = getCouponDates(mat, settlementDate, freq as any);
    accruedInterestPct = calculateAccruedInterest(rate as number, freq as any, dayCount as any, settlementDate, prevCouponDate, nextCouponDate);
  }

  const isFund = selectedInst?.assetClass === 'MutualFund';
  const grossAmount = isFund ? quantity * price : (price / 100) * quantity;
  const accruedAmount = isFund ? 0 : (accruedInterestPct / 100) * quantity;

  let netAmount = grossAmount;
  if (type === 'BUY') {
    netAmount = grossAmount + accruedAmount + fee;
  } else if (type === 'SELL') {
    netAmount = grossAmount + accruedAmount - fee;
  } else if (type === 'REDEMPTION') {
    netAmount = grossAmount + accruedAmount;
  } else if (type === 'COUPON') {
    netAmount = grossAmount;
  } else if (type === 'FEE') {
    netAmount = fee || grossAmount;
  }

  // Validate on trade parameter change
  useEffect(() => {
    setValidationError(null);

    // Rule 1: Trade Date must be strictly after T_0
    if (tradeDate <= snapshotDate) {
      setValidationError(`Trade date (${tradeDate}) must be strictly after inception snapshot date (${snapshotDate}).`);
      return;
    }

    // Rule 2: Quantity must be > 0 for non-fee trades
    if (type !== 'FEE' && quantity <= 0) {
      setValidationError('Trade quantity/notional must be greater than zero.');
      return;
    }

    // Rule 3: Position size check for SELL or REDEMPTION
    if ((type === 'SELL' || type === 'REDEMPTION') && isin) {
      const check = sqliteService.validateTradeSize(isin, tradeDate, type, quantity);
      if (!check.isValid) {
        setValidationError(check.errorMessage || 'Attempting to oversell position.');
      }
    }
  }, [isin, type, tradeDate, quantity, snapshotDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;

    const newTx: Transaction = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      tradeDate,
      settlementDate,
      isin,
      type,
      quantity: type === 'FEE' ? 0 : quantity,
      price: type === 'FEE' ? 0 : price,
      accruedInterestPct: isFund || type === 'COUPON' || type === 'FEE' ? 0 : accruedInterestPct,
      grossAmount,
      netAmount,
      currency: selectedInst?.currency || 'USD',
      counterparty,
      fee,
      notes,
    };

    onSave(newTx);
    onClose();
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">
              Log Standardized Transaction
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Validation Banner if invalid */}
          {validationError && (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-3 rounded flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-rose-200">Trade Validation Constraint:</div>
                <div className="text-[11px] mt-0.5 leading-relaxed">{validationError}</div>
              </div>
            </div>
          )}

          {/* Instrument Selector */}
          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              TARGET INSTRUMENT
            </label>
            <select
              value={isin}
              onChange={(e) => setIsin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-sans"
            >
              {instruments.map((inst) => (
                <option key={inst.isin} value={inst.isin}>
                  {inst.name} ({inst.isin} · {inst.currency} · {inst.assetClass})
                </option>
              ))}
            </select>
          </div>

          {/* Trade Type Buttons */}
          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              TRANSACTION TYPE
            </label>
            <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-1 rounded border border-slate-800">
              {(['BUY', 'SELL', 'COUPON', 'REDEMPTION', 'FEE'] as TransactionType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-1.5 rounded font-mono font-bold text-[11px] transition-colors ${
                    type === t
                      ? t === 'BUY'
                        ? 'bg-emerald-600 text-white'
                        : t === 'SELL'
                        ? 'bg-rose-600 text-white'
                        : 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dates: Trade Date & Settlement Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                TRADE DATE (MUST BE &gt; T_0: {snapshotDate})
              </label>
              <input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                SETTLEMENT DATE
              </label>
              <input
                type="date"
                value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Quantity & Price */}
          {type !== 'FEE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">
                  {isFund ? 'UNITS / SHARES' : 'NOMINAL PAR VALUE'} ({selectedInst?.currency})
                </label>
                <input
                  type="number"
                  step="1000"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">
                  {isFund ? 'UNIT NAV PRICE' : 'CLEAN PRICE (% OF PAR)'}
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={price}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          {/* Fee & Counterparty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                TRANSACTION / CUSTODY FEE ({selectedInst?.currency})
              </label>
              <input
                type="number"
                step="10"
                value={fee}
                onChange={(e) => setFee(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                COUNTERPARTY / BROKER / DEPOSITORY
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-sans"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 font-mono text-[11px] mb-1">
              MANDATE AUDIT NOTES & RATIONALE
            </label>
            <input
              type="text"
              placeholder="e.g. Allocation adjustment, corporate action, or duration rebalance."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Calculation Summary Box */}
          <div className="bg-slate-950 p-3.5 rounded border border-slate-800 space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Gross Consideration:</span>
              <span className="text-white">{formatNumber(grossAmount, 2)} {selectedInst?.currency}</span>
            </div>
            {!isFund && type !== 'FEE' && (
              <div className="flex justify-between text-slate-400">
                <span>Accrued Interest ({accruedInterestPct.toFixed(3)}%):</span>
                <span className="text-indigo-300">+{formatNumber(accruedAmount, 2)} {selectedInst?.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>Fee Impact:</span>
              <span>{fee > 0 ? `${formatNumber(fee, 2)} ${selectedInst?.currency}` : '$0.00'}</span>
            </div>
            <div className="border-t border-slate-800 pt-1.5 flex justify-between font-bold text-xs">
              <span className="text-slate-300">Total Net Settlement Cash Impact:</span>
              <span className={type === 'BUY' || type === 'FEE' ? 'text-rose-400' : 'text-emerald-400'}>
                {type === 'BUY' || type === 'FEE' ? '-' : '+'}{formatNumber(netAmount, 2)} {selectedInst?.currency}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!validationError}
              className={`px-5 py-2 rounded font-medium transition-colors ${
                validationError
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
              }`}
            >
              Post to SQLite Ledger
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
