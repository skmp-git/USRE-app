/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  InceptionSnapshot,
  SnapshotPosition,
  Instrument,
} from '../types/portfolio';
import {
  Save,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Coins,
  CheckCircle,
  RotateCcw,
  Download,
} from 'lucide-react';

interface SnapshotManagerViewProps {
  snapshot: InceptionSnapshot;
  instruments: Instrument[];
  onSaveSnapshot: (updatedSnapshot: InceptionSnapshot) => void;
  onResetDefaultSnapshot: () => void;
}

export const SnapshotManagerView: React.FC<SnapshotManagerViewProps> = ({
  snapshot,
  instruments,
  onSaveSnapshot,
  onResetDefaultSnapshot,
}) => {
  const [snapshotDate, setSnapshotDate] = useState<string>(snapshot.snapshotDate);
  const [portfolioName, setPortfolioName] = useState<string>(snapshot.portfolioName);
  const [notes, setNotes] = useState<string>(snapshot.notes || '');
  const [positions, setPositions] = useState<SnapshotPosition[]>([...snapshot.positions]);
  const [cashBalances, setCashBalances] = useState<Record<string, number>>({ ...snapshot.cashBalances });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New position modal state
  const [newIsin, setNewIsin] = useState<string>(instruments[0]?.isin || '');
  const [newQuantity, setNewQuantity] = useState<number>(500000);
  const [newBookPrice, setNewBookPrice] = useState<number>(100.0);
  const [newAccrued, setNewAccrued] = useState<number>(0.5);

  const instMap = new Map<string, Instrument>();
  for (const i of instruments) {
    instMap.set(i.isin, i);
  }

  const handlePositionChange = (isin: string, field: keyof SnapshotPosition, value: any) => {
    setPositions((prev) =>
      prev.map((p) => (p.isin === isin ? { ...p, [field]: value } : p))
    );
    setHasUnsavedChanges(true);
  };

  const handleRemovePosition = (isin: string) => {
    setPositions((prev) => prev.filter((p) => p.isin !== isin));
    setHasUnsavedChanges(true);
  };

  const handleCashChange = (ccy: string, val: number) => {
    setCashBalances((prev) => ({ ...prev, [ccy]: val }));
    setHasUnsavedChanges(true);
  };

  const handleAddPosition = () => {
    const inst = instMap.get(newIsin);
    if (!inst) return;

    const existing = positions.find((p) => p.isin === newIsin);
    if (existing) {
      alert(`Position for ${newIsin} is already in the snapshot.`);
      return;
    }

    const newPos: SnapshotPosition = {
      isin: newIsin,
      quantity: newQuantity,
      bookPrice: newBookPrice,
      accruedInterestT0: newAccrued,
      currency: inst.currency,
      acquisitionDate: snapshotDate,
    };

    setPositions((prev) => [...prev, newPos]);
    setShowAddModal(false);
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    const updated: InceptionSnapshot = {
      snapshotDate,
      portfolioName,
      notes,
      positions,
      cashBalances,
    };
    onSaveSnapshot(updated);
    setHasUnsavedChanges(false);
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `snapshot_T0_${snapshot.snapshotDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Description & Action Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">
              T_0 Inception Snapshot Configuration
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            The portfolio is inherited. History prior to T_0 is frozen into this comprehensive opening snapshot. All subsequent state rolling originates from here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={onResetDefaultSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Restore Heritage Default</span>
          </button>

          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-colors ${
              hasUnsavedChanges
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>{hasUnsavedChanges ? 'Save & Roll Forward' : 'Saved'}</span>
          </button>
        </div>
      </div>

      {/* Mandate & Date Metadata Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-slate-400 font-mono text-[11px] mb-1">
            INCEPTION DATE (T_0)
          </label>
          <input
            type="date"
            value={snapshotDate}
            onChange={(e) => {
              setSnapshotDate(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-mono text-[11px] mb-1">
            PORTFOLIO / MANDATE NAME
          </label>
          <input
            type="text"
            value={portfolioName}
            onChange={(e) => {
              setPortfolioName(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-mono text-[11px] mb-1">
            MANDATE INCEPTION NOTES
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setHasUnsavedChanges(true);
            }}
            className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 focus:outline-none focus:border-indigo-500 font-sans"
          />
        </div>
      </div>

      {/* Inception Cash Balances Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-4 h-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
            Initial Inception Cash Balances (T_0)
          </h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from(
            new Set(['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', ...Object.keys(cashBalances)])
          ).map((ccy) => (
            <div key={ccy} className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                {ccy} OPENING CASH
              </label>
              <input
                type="number"
                step={ccy === 'JPY' ? '1000000' : '10000'}
                value={cashBalances[ccy] !== undefined ? cashBalances[ccy] : 0}
                onChange={(e) => handleCashChange(ccy, parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs p-1.5 rounded focus:outline-none focus:border-indigo-500 tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Snapshot Positions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
              Initial Holdings Inventory ({positions.length} Positions as of T_0)
            </h4>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Inception Position</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                <th className="py-2.5 px-3">ISIN / TICKER</th>
                <th className="py-2.5 px-3">SECURITY NAME</th>
                <th className="py-2.5 px-2">ASSET TYPE</th>
                <th className="py-2.5 px-2">CCY</th>
                <th className="py-2.5 px-3 text-right">PAR / SHARES (T_0)</th>
                <th className="py-2.5 px-3 text-right">BOOK PRICE (%/NAV)</th>
                <th className="py-2.5 px-3 text-right">ACCRUED AT T_0 (%)</th>
                <th className="py-2.5 px-3 text-right">EST. BOOK VALUE</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {positions.map((pos) => {
                const inst = instMap.get(pos.isin);
                const isFund = inst?.assetClass === 'MutualFund';
                const bookValue = isFund ? pos.quantity * pos.bookPrice : (pos.bookPrice / 100) * pos.quantity;

                return (
                  <tr key={pos.isin} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-indigo-300">{pos.isin}</td>

                    <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                      {inst?.name || pos.isin}
                    </td>

                    <td className="py-2.5 px-2 text-slate-400 font-sans">
                      {inst?.assetClass || 'DirectBond'}
                    </td>

                    <td className="py-2.5 px-2 text-slate-400 font-mono">{pos.currency}</td>

                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="10000"
                        value={pos.quantity}
                        onChange={(e) => handlePositionChange(pos.isin, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-28 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono text-white text-[11px]"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={pos.bookPrice}
                        onChange={(e) => handlePositionChange(pos.isin, 'bookPrice', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono text-white text-[11px]"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={pos.accruedInterestT0}
                        onChange={(e) => handlePositionChange(pos.isin, 'accruedInterestT0', parseFloat(e.target.value) || 0)}
                        className="w-16 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono text-white text-[11px]"
                      />
                    </td>

                    <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                      {formatNumber(bookValue, 0)} {pos.currency}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleRemovePosition(pos.isin)}
                        className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        title="Remove position from T_0 snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Position Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-lg shadow-2xl p-5 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase font-mono">
              Add Opening Position to Snapshot
            </h3>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                SELECT INSTRUMENT
              </label>
              <select
                value={newIsin}
                onChange={(e) => setNewIsin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 font-sans"
              >
                {instruments.map((i) => (
                  <option key={i.isin} value={i.isin}>
                    {i.name} ({i.isin} · {i.currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">
                  QUANTITY / PAR
                </label>
                <input
                  type="number"
                  step="10000"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-mono text-[11px] mb-1">
                  BOOK PRICE (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBookPrice}
                  onChange={(e) => setNewBookPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono text-[11px] mb-1">
                ACCRUED INTEREST AT T_0 (% OF PAR)
              </label>
              <input
                type="number"
                step="0.01"
                value={newAccrued}
                onChange={(e) => setNewAccrued(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded p-2 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded bg-slate-800 text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPosition}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-xs"
              >
                Add to Snapshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
