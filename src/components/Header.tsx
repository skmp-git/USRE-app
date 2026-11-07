/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Currency,
} from '../types/portfolio';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Download,
  Terminal,
  BookOpen,
} from 'lucide-react';
import { addMonths, formatDate, parseDate } from '../services/quantitativeEngine';
import { DataInputGuideModal } from './DataInputGuideModal';

interface HeaderProps {
  valuationDate: string;
  setValuationDate: (date: string) => void;
  snapshotDate: string;
  baseCurrency: Currency;
  setBaseCurrency: (ccy: Currency) => void;
  activeTab: 'dashboard' | 'transactions' | 'marketData' | 'sqlite';
  setActiveTab: (tab: 'dashboard' | 'transactions' | 'marketData' | 'sqlite') => void;
  onResetData: () => void;
  onExportSqlite: () => void;
  transactionsCount: number;
  totalPositionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  valuationDate,
  setValuationDate,
  snapshotDate,
  baseCurrency,
  setBaseCurrency,
  activeTab,
  setActiveTab,
  onResetData,
  onExportSqlite,
  transactionsCount,
  totalPositionsCount,
}) => {
  const [isGuideOpen, setIsGuideOpen] = React.useState(false);
  const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'];

  const stepDate = (days: number) => {
    const d = parseDate(valuationDate);
    d.setUTCDate(d.getUTCDate() + days);
    setValuationDate(formatDate(d));
  };

  const stepMonths = (months: number) => {
    setValuationDate(addMonths(valuationDate, months));
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 select-none">
      {/* Top Application Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800/80 gap-6">
        {/* Left: Brand / Mandate Title */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded flex items-center justify-center font-mono font-bold text-sm text-white shadow-sm">
              FI
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>PORTFOLIO WORKSTATION</span>
                <span className="text-xs font-normal text-slate-400 font-mono">
                  [T_0: {snapshotDate}]
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal">
                Heritage Mandate · SQLite Engine · Roll-Forward Engine
              </div>
            </div>
          </div>
        </div>

        {/* Center: Global Valuation Date Selector (T_n) */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded border border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-300">Valuation Date (T_n):</span>
          </div>

          <button
            onClick={() => stepMonths(-1)}
            title="Minus 1 Month"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors text-xs"
          >
            -1M
          </button>
          <button
            onClick={() => stepDate(-7)}
            title="Minus 1 Week"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <input
            type="date"
            value={valuationDate}
            onChange={(e) => e.target.value && setValuationDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white font-mono text-xs px-2.5 py-1 rounded focus:outline-none focus:border-indigo-500 cursor-pointer"
          />

          <button
            onClick={() => stepDate(7)}
            title="Plus 1 Week"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => stepMonths(1)}
            title="Plus 1 Month"
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors text-xs"
          >
            +1M
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Quick jumps */}
          <button
            onClick={() => setValuationDate(snapshotDate)}
            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            T_0
          </button>
          <button
            onClick={() => setValuationDate('2026-11-02')}
            className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Right: Currency & Database Utilities */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Base Currency Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs">
            <span className="text-slate-400 text-[11px]">Base CCY:</span>
            <div className="flex items-center gap-1">
              {currencies.map((ccy) => (
                <button
                  key={ccy}
                  onClick={() => setBaseCurrency(ccy)}
                  className={`px-2 py-0.5 rounded font-mono text-[11px] font-medium transition-colors ${
                    baseCurrency === ccy
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {ccy}
                </button>
              ))}
            </div>
          </div>

          {/* SQLite DB Binary Export */}
          <button
            onClick={onExportSqlite}
            title="Download SQLite .sqlite database file"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono text-[11px]">Export .db</span>
          </button>

          {/* Data Input Guide / README */}
          <button
            onClick={() => setIsGuideOpen(true)}
            title="View README & Data Input Specification"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-indigo-200 rounded border border-indigo-700/50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-[11px]">Data Guide (READ.ME)</span>
          </button>

          {/* Reset / Reseed Data */}
          <button
            onClick={onResetData}
            title="Reset database to realistic default state"
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="text-[11px]">Reset</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation Bar */}
      <div className="flex items-center justify-between px-5 bg-slate-900/90 text-xs border-b border-slate-800">
        <nav className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'dashboard'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>Portfolio Dashboard & Analytics</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-800 rounded text-slate-300">
              {totalPositionsCount} positions
            </span>
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>Transaction Ledger & Inception Snapshot</span>
            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-800 rounded text-slate-300">
              {transactionsCount} ledgered
            </span>
          </button>

          <button
            onClick={() => setActiveTab('marketData')}
            className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'marketData'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>Market Data & Valuation Ingestion</span>
          </button>

          <button
            onClick={() => setActiveTab('sqlite')}
            className={`px-4 py-2.5 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sqlite'
                ? 'border-indigo-500 text-white bg-slate-800/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQLite Database Engine</span>
            <span className="font-mono text-[10px] text-emerald-400">ACTIVE</span>
          </button>
        </nav>

        {/* Workstation Status */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>SQL WASM OK</span>
          </div>
          <span className="text-slate-600">|</span>
          <span>DayCount: 30/360 · Act/Act · Act/360</span>
        </div>
      </div>

      {/* In-App Data Input Guide / README Modal */}
      <DataInputGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />
    </header>
  );
};
