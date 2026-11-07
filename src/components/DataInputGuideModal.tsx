/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Calendar,
  Layers,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';

interface DataInputGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataInputGuideModal: React.FC<DataInputGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeGuideTab, setActiveGuideTab] = useState<
    'overview' | 'snapshot' | 'transactions' | 'marketData' | 'instruments' | 'formulas'
  >('overview');

  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-text">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Fixed Income Portfolio Workstation — Data Input & Schema Guide</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                  READ.ME SPEC
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Quantitative specifications, T_0 inception snapshot roll-forward rules, and data formatting guidelines.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 text-xs overflow-x-auto">
          {[
            { id: 'overview', label: '1. Roll-Forward Concept', icon: Layers },
            { id: 'snapshot', label: '2. T_0 Inception Snapshot', icon: Calendar },
            { id: 'transactions', label: '3. Transaction Ledger', icon: Activity },
            { id: 'marketData', label: '4. Prices, FX & Yield Curves', icon: DollarSign },
            { id: 'instruments', label: '5. Asset Classes & Notes', icon: HelpCircle },
            { id: 'formulas', label: '6. Formulas & Attribution', icon: TrendingUp },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeGuideTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveGuideTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-500 text-indigo-300 bg-slate-800/30'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm leading-relaxed text-slate-300 font-sans">
          {activeGuideTab === 'overview' && (
            <div className="space-y-5">
              <div className="p-4 rounded-lg bg-indigo-950/30 border border-indigo-800/40">
                <h3 className="font-semibold text-white text-base mb-1">
                  Core Architecture: The Inception Snapshot Concept
                </h3>
                <p className="text-xs text-slate-300">
                  Fixed income portfolios are frequently inherited with years of prior history. Rather than reconstructing decades of historical transactions, this workstation initializes state at an exact Inception Date ($T_0$) using a verified snapshot, and ledger-records all transactions strictly after $T_0$.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-xs font-mono font-semibold text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Dynamic State Rolling
                  </div>
                  <div className="font-mono text-xs text-emerald-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                    Holdings(T_n) = Snapshot(T_0) + ∑ Transactions(t) [t = T_0 → T_n]
                  </div>
                  <p className="text-xs text-slate-400">
                    Any arbitrary target valuation date ($T_n$) can be selected at will via the top calendar. The engine scans the chronological ledger and recalculates position face values, cash balances, and weighted-average cost basis on the fly.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-xs font-mono font-semibold text-indigo-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Local SQLite Persistence
                  </div>
                  <div className="font-mono text-xs text-emerald-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                    Tables: instruments, snapshot, transactions, market_prices, fx_rates
                  </div>
                  <p className="text-xs text-slate-400">
                    Data is stored locally in an embedded SQLite engine (backed up in local browser memory). You can run ad-hoc SQL queries or click <strong>Export .db</strong> in the header to download a complete binary `.sqlite` database file anytime.
                  </p>
                </div>
              </div>

              {/* Desktop Launcher (.BAT) Quick Start */}
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Desktop App Launcher (.BAT) for Windows</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/40">
                    ONE-CLICK RUN
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Choose either launcher option from the workstation root directory:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="bg-slate-950 p-2 rounded border border-emerald-900/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-emerald-400 font-semibold">NO NODE.JS REQUIRED</div>
                      <div className="text-xs font-mono text-slate-200">launch_without_node.bat</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard('launch_without_node.bat', 'bat-no-node')}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
                    >
                      {copiedSnippet === 'bat-no-node' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-indigo-900/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-indigo-400 font-semibold">NODE.JS DEV SERVER</div>
                      <div className="text-xs font-mono text-slate-200">run_desktop.bat</div>
                    </div>
                    <button
                      onClick={() => copyToClipboard('run_desktop.bat', 'bat-cmd')}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-700"
                    >
                      {copiedSnippet === 'bat-cmd' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
                  <li><strong>Instant Run (No setup):</strong> <code className="text-emerald-300">launch_without_node.bat</code> uses Windows built-in PowerShell web server to launch instantly in your browser without downloading or configuring anything.</li>
                  <li><strong>Full Dev Server:</strong> <code className="text-indigo-300">run_desktop.bat</code> uses Node.js with hot-reloading and direct Vite serving.</li>
                  <li><strong>Prompt window guarantee:</strong> Both launchers now use persistent Windows <code className="text-slate-300">cmd /k</code> sessions, so the console window will <strong>never vanish or close on error</strong>.</li>
                  <li><strong>ZIP Notice:</strong> Make sure you extract the project zip before running (do not run directly from inside a zip viewer).</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Standard Input Units Summary
                </h4>
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                      <tr>
                        <th className="p-2.5">Field / Metric</th>
                        <th className="p-2.5">Input Format</th>
                        <th className="p-2.5">Unit Convention</th>
                        <th className="p-2.5">Example</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono text-slate-300">
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-white">Bond Clean Price</td>
                        <td className="p-2.5">Decimal number</td>
                        <td className="p-2.5">Points per 100 par</td>
                        <td className="p-2.5 text-indigo-400">101.25</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-white">Coupon Rate</td>
                        <td className="p-2.5">Decimal or %</td>
                        <td className="p-2.5">Annualized decimal (e.g. 0.045 = 4.5%)</td>
                        <td className="p-2.5 text-indigo-400">0.0450 (4.50%)</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-white">Quantity / Par</td>
                        <td className="p-2.5">Integer / Float</td>
                        <td className="p-2.5">Currency face value or fund shares</td>
                        <td className="p-2.5 text-indigo-400">1,000,000</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-white">Credit Spread</td>
                        <td className="p-2.5">Basis Points</td>
                        <td className="p-2.5">1 bps = 0.01% = 0.0001</td>
                        <td className="p-2.5 text-indigo-400">+142 bps</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-white">Dates</td>
                        <td className="p-2.5">ISO-8601</td>
                        <td className="p-2.5">YYYY-MM-DD</td>
                        <td className="p-2.5 text-indigo-400">2026-11-02</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeGuideTab === 'snapshot' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">
                Configuring the T_0 Inception Snapshot
              </h3>
              <p className="text-xs text-slate-300">
                Access this under <strong>Transactions & Snapshot → T_0 Inception Snapshot Configuration</strong>.
                The snapshot represents the certified baseline holdings and initial cash when you assumed management of the portfolio.
              </p>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="font-semibold text-xs text-indigo-400 uppercase tracking-wider font-mono">
                  Required Snapshot Fields
                </div>
                <ul className="list-disc pl-5 text-xs space-y-2 text-slate-300">
                  <li>
                    <strong className="text-white">Snapshot Date (T_0):</strong> ISO date format <code className="text-indigo-400 bg-slate-900 px-1 py-0.5 rounded">YYYY-MM-DD</code>. All transactions recorded in the app must have <code className="text-indigo-400">tradeDate &gt; T_0</code>.
                  </li>
                  <li>
                    <strong className="text-white">Initial Cash Balances:</strong> Starting cash balances segregated by currency (<code className="text-emerald-400">USD</code>, <code className="text-emerald-400">EUR</code>, <code className="text-emerald-400">GBP</code>, <code className="text-emerald-400">CHF</code>). Cash movements from trades, fees, and coupons increment or decrement these balances.
                  </li>
                  <li>
                    <strong className="text-white">Position Holdings:</strong> An array of certified holdings at $T_0$:
                    <div className="mt-2 pl-4 border-l-2 border-slate-800 space-y-1 text-slate-400">
                      <div>• <strong>ISIN:</strong> Unique identifier linking to the instrument catalog.</div>
                      <div>• <strong>Quantity:</strong> Face value (e.g., $1,000,000 for bonds) or number of shares (for funds).</div>
                      <div>• <strong>Book Clean Price:</strong> Inception acquisition price per 100 par (e.g., 99.50).</div>
                      <div>• <strong>Accrued Interest (AI_0):</strong> Points per 100 par accrued on $T_0$ (e.g., 0.75).</div>
                      <div>• <strong>Currency:</strong> ISO code matching security denomination.</div>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">Sample JSON Snapshot Representation:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            date: '2025-12-31',
                            cashBalances: { USD: 750000, EUR: 350000, GBP: 200000, CHF: 150000 },
                            positions: [
                              {
                                isin: 'US91282CDP39',
                                quantity: 1500000,
                                bookCleanPrice: 98.75,
                                bookAccruedInterest: 0.825,
                                currency: 'USD',
                                acquisitionDate: '2025-12-31',
                              },
                            ],
                          },
                          null,
                          2
                        ),
                        'snap-sample'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    {copiedSnippet === 'snap-sample' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'snap-sample' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
{`{
  "date": "2025-12-31",
  "cashBalances": { "USD": 750000, "EUR": 350000, "GBP": 200000, "CHF": 150000 },
  "positions": [
    {
      "isin": "US91282CDP39",
      "quantity": 1500000,
      "bookCleanPrice": 98.75,
      "bookAccruedInterest": 0.825,
      "currency": "USD",
      "acquisitionDate": "2025-12-31"
    }
  ]
}`}
                </pre>
              </div>
            </div>
          )}

          {activeGuideTab === 'transactions' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">
                Logging Post-T_0 Transactions
              </h3>
              <p className="text-xs text-slate-300">
                All portfolio operations occurring after $T_0$ must be recorded through the standardized trade ticket. Click <strong>+ Log Transaction</strong> in the Transactions tab.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-xs font-mono font-bold text-emerald-400">BUY TRANSACTION</div>
                  <p className="text-xs text-slate-400">
                    Increases holding quantity. Cash is debited by <code className="text-indigo-300">Qty × (Price + Accrued)/100 + Fee</code>. Cost basis is adjusted using Weighted Average Cost (WAC).
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-xs font-mono font-bold text-rose-400">SELL TRANSACTION</div>
                  <p className="text-xs text-slate-400">
                    Decreases holding quantity. Cash is credited. Pre-trade validation automatically rejects any sell order that would cause a short position as of that trade date.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-xs font-mono font-bold text-amber-400">COUPON PAYMENT</div>
                  <p className="text-xs text-slate-400">
                    Records incoming interest distribution. Face value remains unchanged. Cash increases by gross coupon minus custodial withholding/fees.
                  </p>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-xs font-mono font-bold text-purple-400">REDEMPTION / SINKING FUND</div>
                  <p className="text-xs text-slate-400">
                    Records partial or full maturity repayment of bond par. Face value decreases and cash is credited at par (or specified redemption price).
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300">Validation Checks Enforced by Workstation:</div>
                <div className="text-xs space-y-1 text-slate-400">
                  <div>1. <strong>Date Rule:</strong> <code className="text-indigo-400">Trade Date &ge; T_0</code>. Trades dated prior to snapshot date are flagged with warning.</div>
                  <div>2. <strong>Short Sale Rule:</strong> <code className="text-indigo-400">Sell Quantity &le; Available Position(Trade Date)</code>.</div>
                  <div>3. <strong>Settlement Rule:</strong> <code className="text-indigo-400">Settlement Date &ge; Trade Date</code>.</div>
                </div>
              </div>

              {/* NEW: Batch CSV Ingestion & Templates Guide */}
              <div className="p-4 bg-indigo-950/30 border border-indigo-800/60 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Batch CSV Upload Desk & Downloadable Templates</span>
                  </div>
                  <span className="text-[10px] font-mono bg-indigo-900/80 text-indigo-200 px-2 py-0.5 rounded border border-indigo-700/50">
                    MULTI-FILE UPLOAD
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Instead of logging positions one-by-one, switch to <strong>Batch CSV Ingestion & Templates</strong> inside the Transaction Ledger. You can drag & drop a list of multiple CSV files simultaneously (e.g. separate trade blotters, custody coupon reports, and redemption files).
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-emerald-400 font-bold block mb-1">1. Append Mode</span>
                    Safely appends all parsed transactions across uploaded CSV files into the existing SQLite ledger.
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-rose-400 font-bold block mb-1">2. Replace Mode</span>
                    Replaces all existing post-T_0 transactions with the new uploaded dataset for clean reconciliations.
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">Downloadable Templates Provided:</div>
                  <div className="text-slate-400 pl-2 space-y-0.5">
                    <div>• <strong>All-in-One Ledger Template (.csv):</strong> Includes BUY, SELL, COUPON, REDEMPTION, and FEE examples.</div>
                    <div>• <strong>Trades Blotter Template (.csv):</strong> Focused on buy/sell executions with par and prices.</div>
                    <div>• <strong>Coupons & Redemptions Template (.csv):</strong> Formatted for cash income and principal repayments.</div>
                    <div>• <strong>Active Catalog Sample (.csv):</strong> Pre-populated with your portfolio's actual active ISINs and currencies.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeGuideTab === 'marketData' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">
                Market Clean Prices, FX Spot Rates & Yield Curves
              </h3>
              <p className="text-xs text-slate-300">
                Configure your observable valuation inputs under the <strong>Market Data & Valuation Ingestion</strong> tab.
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-bold text-indigo-400 mb-1">Clean Prices ($T_n$)</h4>
                  <p className="text-xs text-slate-400">
                    Input prices per 100 par (e.g., 99.85). The calculation engine automatically computes the accrued interest $AI(T_n)$ using the instrument's Day Count Convention (e.g. 30/360, Act/Act ICMA, Act/360) and determines:
                  </p>
                  <div className="mt-2 font-mono text-xs text-emerald-300 bg-slate-900 p-2 rounded">
                    Dirty Price = Clean Price + Accrued Interest(T_n)
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-bold text-indigo-400 mb-1">Foreign Exchange (FX) Rates & Multi-Currency Engine</h4>
                  <p className="text-xs text-slate-400">
                    The workstation natively supports positions denominated in various local currencies (USD, EUR, GBP, CHF, JPY, CAD, AUD, etc.):
                  </p>
                  <div className="mt-2 text-xs space-y-1.5 text-slate-300">
                    <div>• <strong>Local Valuation:</strong> <code className="text-indigo-400 font-mono">MV_local = (DirtyPrice / 100) × Quantity</code> in the security's native currency.</div>
                    <div>• <strong>Base Translation:</strong> <code className="text-indigo-400 font-mono">MV_base = MV_local × FX_Multiplier(Local → Base)</code>.</div>
                    <div>• <strong>FX Triangulation:</strong> Direct quotes (e.g. EUR/USD), inverse pairs (e.g. USD/JPY), and USD-pivot cross triangulation (e.g. JPY → EUR via USD) are computed automatically.</div>
                    <div>• <strong>Multi-Currency Cash Ledger:</strong> Trades, coupons, and fees are debited/credited strictly in the transaction's currency (e.g., JGB coupon credits JPY cash). Total cash is aggregated by translating all local balances to the chosen base currency.</div>
                    <div>• <strong>Global Base Currency Switch:</strong> Switching Base CCY in the top bar immediately converts all portfolio market values, DV01, and returns into that currency.</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <h4 className="text-xs font-bold text-indigo-400 mb-1">Benchmark Yield Curves</h4>
                  <p className="text-xs text-slate-400">
                    Tenors: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y. Rates are entered in annualized percent (e.g., 4.28%). These par curves form the baseline for Key Rate Duration (KRD) sensitivity and curve spread analytics.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeGuideTab === 'instruments' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">
                Supported Instrument Classes & Data Attributes
              </h3>
              <p className="text-xs text-slate-300">
                The workstation includes native quantitative models for multiple fixed income structures:
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">1. Direct Fixed-Rate Bonds</span>
                    <span className="font-mono text-[10px] text-slate-400">DirectBond</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Standard fixed coupon bullet and amortizing bonds.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
                    <div className="bg-slate-900 p-1.5 rounded">couponRate: decimal</div>
                    <div className="bg-slate-900 p-1.5 rounded">couponFrequency: enum</div>
                    <div className="bg-slate-900 p-1.5 rounded">dayCountConvention: enum</div>
                    <div className="bg-slate-900 p-1.5 rounded">seniority: enum</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">2. Cap-Floor Floating Rate Notes (FRNs)</span>
                    <span className="font-mono text-[10px] text-slate-400">CapFloorFloater</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Floating coupon indexed to SOFR or EURIBOR with optional cap ceiling and floor safety.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
                    <div className="bg-slate-900 p-1.5 rounded">referenceRate: SOFR/EURIBOR</div>
                    <div className="bg-slate-900 p-1.5 rounded">marginBps: spread in bps</div>
                    <div className="bg-slate-900 p-1.5 rounded">capLevel: max coupon</div>
                    <div className="bg-slate-900 p-1.5 rounded">floorLevel: min coupon</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">3. Bond-Linked Notes (Short Put / Structured)</span>
                    <span className="font-mono text-[10px] text-slate-400">BondLinkedNote</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Principal protection floor combined with equity or index upside participation.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300">
                    <div className="bg-slate-900 p-1.5 rounded">protectionFloor: 0.90</div>
                    <div className="bg-slate-900 p-1.5 rounded">participationRate: 0.80</div>
                    <div className="bg-slate-900 p-1.5 rounded">strikePrice: 100.00</div>
                    <div className="bg-slate-900 p-1.5 rounded">underlyingAsset: name</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">4. Fixed Income Mutual Funds</span>
                    <span className="font-mono text-[10px] text-slate-400">MutualFund</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Priced on Net Asset Value (NAV) with distributing or accumulating dividend policies.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeGuideTab === 'formulas' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-white text-base">
                Performance Attribution & Quantitative Formulas
              </h3>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  Total Return Decomposition (YTD / QTD / MTD)
                </div>
                <div className="font-mono text-sm text-emerald-300 bg-slate-900 p-3 rounded border border-slate-800">
                  R_total = R_price + R_coupon
                </div>
                <div className="text-xs space-y-2 text-slate-300">
                  <div>
                    <strong className="text-white">Price Return:</strong> Capital gain or loss from clean price changes relative to dirty price at the start of the period:
                    <div className="font-mono text-slate-400 pl-3 mt-1">
                      R_price = [ P_clean(T_n) - P_clean(T_start) ] / P_dirty(T_start)
                    </div>
                  </div>
                  <div>
                    <strong className="text-white">Coupon Return:</strong> Income return comprising accrued interest change plus received cash coupons:
                    <div className="font-mono text-slate-400 pl-3 mt-1">
                      R_coupon = [ (AI(T_n) - AI(T_start)) + CashCoupons ] / P_dirty(T_start)
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider">
                  9 Key Rate Durations (KRD)
                </div>
                <p className="text-xs text-slate-400">
                  Calculated across standard tenors: <strong>6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y</strong> using triangular tent-function interpolation.
                </p>
                <div className="font-mono text-xs text-indigo-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                  ΔP / P ≈ -∑ [ KRD_i × Δy_i ]
                </div>
                <div className="font-mono text-xs text-emerald-300 bg-slate-900 p-2.5 rounded border border-slate-800">
                  DV01_i = MarketValue × ModifiedDuration_i × 0.0001
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="font-mono text-[11px]">
            File reference: <span className="text-indigo-400">/READ.ME</span> & <span className="text-indigo-400">/README.md</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
