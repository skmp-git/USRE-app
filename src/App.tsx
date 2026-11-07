/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Currency,
  Instrument,
  InceptionSnapshot,
  Transaction,
  MarketPrice,
  FxRate,
  YieldCurvePoint,
  PortfolioValuationResult,
  PositionValuation,
  TransactionType,
} from './types/portfolio';
import { sqliteService } from './services/sqliteStorage';
import {
  SAMPLE_INSTRUMENTS,
  INITIAL_SNAPSHOT_T0,
  SAMPLE_TRANSACTIONS,
  SAMPLE_MARKET_PRICES,
  SAMPLE_FX_RATES,
  SAMPLE_YIELD_CURVES,
} from './services/sampleData';
import {
  valuatePosition,
  aggregatePortfolio,
} from './services/quantitativeEngine';
import { Header } from './components/Header';
import { PortfolioAnalyticsView } from './components/PortfolioAnalyticsView';
import { TransactionLedgerView } from './components/TransactionLedgerView';
import { SnapshotManagerView } from './components/SnapshotManagerView';
import { MarketDataView } from './components/MarketDataView';
import { SqliteInspectorView } from './components/SqliteInspectorView';
import { LogTransactionModal } from './components/LogTransactionModal';
import { InstrumentDetailModal } from './components/InstrumentDetailModal';

export default function App() {
  const [isDbReady, setIsDbReady] = useState<boolean>(true);
  const [valuationDate, setValuationDate] = useState<string>('2026-11-02');
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'marketData' | 'sqlite'>('dashboard');
  const [transactionsSubView, setTransactionsSubView] = useState<'ledger' | 'snapshot'>('ledger');

  // Core Data State pre-seeded with heritage portfolio data
  const [instruments, setInstruments] = useState<Instrument[]>(SAMPLE_INSTRUMENTS);
  const [snapshot, setSnapshot] = useState<InceptionSnapshot | null>(INITIAL_SNAPSHOT_T0);
  const [transactions, setTransactions] = useState<Transaction[]>(SAMPLE_TRANSACTIONS);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>(SAMPLE_MARKET_PRICES);
  const [fxRates, setFxRates] = useState<FxRate[]>(SAMPLE_FX_RATES);
  const [yieldCurves, setYieldCurves] = useState<YieldCurvePoint[]>(SAMPLE_YIELD_CURVES);

  // Modals
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [tradeModal, setTradeModal] = useState<{
    isOpen: boolean;
    defaultIsin?: string;
    defaultType?: TransactionType;
  }>({ isOpen: false });

  // Initialize SQLite Database
  const reloadDataFromSqlite = useCallback(() => {
    const insts = sqliteService.getInstruments();
    const snap = sqliteService.getInceptionSnapshot();
    const txs = sqliteService.getTransactions();
    const prices = sqliteService.getMarketPrices();
    const fx = sqliteService.getFxRates();
    const curves = sqliteService.getYieldCurves();

    if (insts && insts.length > 0) setInstruments(insts);
    if (snap) setSnapshot(snap);
    if (txs) setTransactions(txs);
    if (prices && prices.length > 0) setMarketPrices(prices);
    if (fx && fx.length > 0) setFxRates(fx);
    if (curves && curves.length > 0) setYieldCurves(curves);
  }, []);

  const seedSampleData = useCallback(() => {
    sqliteService.saveInstrumentsBatch(SAMPLE_INSTRUMENTS);
    sqliteService.setInceptionSnapshot(INITIAL_SNAPSHOT_T0);
    for (const tx of SAMPLE_TRANSACTIONS) {
      sqliteService.addTransaction(tx);
    }
    sqliteService.saveMarketPrices(SAMPLE_MARKET_PRICES);
    sqliteService.saveFxRates(SAMPLE_FX_RATES);
    sqliteService.saveYieldCurves(SAMPLE_YIELD_CURVES);
    reloadDataFromSqlite();
  }, [reloadDataFromSqlite]);

  useEffect(() => {
    sqliteService.init().then(() => {
      const existingSnap = sqliteService.getInceptionSnapshot();
      if (!existingSnap || existingSnap.positions.length < INITIAL_SNAPSHOT_T0.positions.length) {
        seedSampleData();
      } else {
        reloadDataFromSqlite();
      }
      setIsDbReady(true);
    }).catch((err) => {
      console.warn('SQLite init handled with embedded store:', err);
      setIsDbReady(true);
    });
  }, [seedSampleData, reloadDataFromSqlite]);

  // Handle resetting data
  const handleResetData = useCallback(() => {
    if (confirm('Reset database to default heritage portfolio state? All edits will be refreshed.')) {
      sqliteService.resetAllData();
      seedSampleData();
    }
  }, [seedSampleData]);

  // Handle SQLite export binary
  const handleExportSqlite = useCallback(() => {
    const binary = sqliteService.exportSqliteBinary();
    if (!binary) return;
    const blob = new Blob([binary as any], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed_income_portfolio_${valuationDate}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  }, [valuationDate]);

  // State Reconstruction & Quantitative Analytics Calculation
  // Dynamically computes holdings(T_n) = snapshot(T_0) + sum(transactions T_0 to T_n)
  const analytics: PortfolioValuationResult | null = useMemo(() => {
    if (!snapshot || instruments.length === 0) return null;

    // 1. Roll forward positions and cash from SQLite
    const rolled = sqliteService.rollPortfolioState(valuationDate);

    // Map instruments by ISIN
    const instMap = new Map<string, Instrument>();
    for (const inst of instruments) {
      instMap.set(inst.isin, inst);
    }

    // 2. Valuate each rolled holding
    const valuations: PositionValuation[] = [];
    for (const rolledPos of rolled.positions) {
      const inst = instMap.get(rolledPos.isin);
      if (!inst) continue;

      const posVal = valuatePosition(
        inst,
        rolledPos.quantity,
        rolledPos.costPrice,
        valuationDate,
        marketPrices,
        fxRates,
        baseCurrency
      );
      valuations.push(posVal);
    }

    // 3. Aggregate portfolio level metrics, risk breakdowns & returns
    return aggregatePortfolio(
      valuations,
      rolled.cashBalances,
      valuationDate,
      snapshot.snapshotDate,
      baseCurrency,
      fxRates,
      instruments,
      snapshot,
      transactions
    );
  }, [isDbReady, snapshot, instruments, valuationDate, marketPrices, fxRates, baseCurrency, transactions]);

  // Transaction Actions
  const handleSaveTransaction = (tx: Transaction) => {
    sqliteService.addTransaction(tx);
    reloadDataFromSqlite();
  };

  const handleSaveTransactionsBatch = (txs: Transaction[], replaceExisting: boolean = false) => {
    sqliteService.addTransactionsBatch(txs, replaceExisting);
    reloadDataFromSqlite();
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this ledgered transaction? Portfolio state will be dynamically rolled forward.')) {
      sqliteService.deleteTransaction(id);
      reloadDataFromSqlite();
    }
  };

  // Snapshot Actions
  const handleSaveSnapshot = (updatedSnapshot: InceptionSnapshot) => {
    sqliteService.setInceptionSnapshot(updatedSnapshot);
    reloadDataFromSqlite();
  };

  const handleResetDefaultSnapshot = () => {
    if (confirm('Restore default initial T_0 snapshot?')) {
      sqliteService.setInceptionSnapshot(INITIAL_SNAPSHOT_T0);
      reloadDataFromSqlite();
    }
  };

  // Market Data Actions
  const handleSavePrices = (prices: MarketPrice[]) => {
    sqliteService.saveMarketPrices(prices);
    reloadDataFromSqlite();
  };

  const handleSaveFxRates = (rates: FxRate[]) => {
    sqliteService.saveFxRates(rates);
    reloadDataFromSqlite();
  };

  const handleSaveYieldCurves = (curves: YieldCurvePoint[]) => {
    sqliteService.saveYieldCurves(curves);
    reloadDataFromSqlite();
  };

  const handleTradeInstrument = (isin: string, type: 'BUY' | 'SELL' | 'COUPON' | 'REDEMPTION' = 'BUY') => {
    setTradeModal({
      isOpen: true,
      defaultIsin: isin,
      defaultType: type,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Workstation Header */}
      <Header
        valuationDate={valuationDate}
        setValuationDate={setValuationDate}
        snapshotDate={snapshot?.snapshotDate || '2025-12-31'}
        baseCurrency={baseCurrency}
        setBaseCurrency={setBaseCurrency}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onResetData={handleResetData}
        onExportSqlite={handleExportSqlite}
        transactionsCount={transactions.length}
        totalPositionsCount={analytics?.positions.length || 0}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-5 max-w-[1600px] w-full mx-auto space-y-4">
        {/* Tab 1: Portfolio Dashboard & Analytics */}
        {activeTab === 'dashboard' && analytics && (
          <PortfolioAnalyticsView
            analytics={analytics}
            baseCurrency={baseCurrency}
            yieldCurves={yieldCurves}
            onSelectInstrument={(inst) => setSelectedInstrument(inst)}
            onTradeInstrument={handleTradeInstrument}
          />
        )}

        {/* Tab 2: Transaction Ledger & Snapshot Management */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Sub-Switch: Ledger vs T_0 Snapshot */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs w-fit">
              <button
                onClick={() => setTransactionsSubView('ledger')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  transactionsSubView === 'ledger'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Post-T_0 Transaction Ledger ({transactions.length})
              </button>
              <button
                onClick={() => setTransactionsSubView('snapshot')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  transactionsSubView === 'snapshot'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                T_0 Inception Snapshot Configuration
              </button>
            </div>

            {transactionsSubView === 'ledger' ? (
              <TransactionLedgerView
                transactions={transactions}
                instruments={instruments}
                snapshotDate={snapshot?.snapshotDate || '2025-12-31'}
                onAddTransactionClick={() => setTradeModal({ isOpen: true, defaultType: 'BUY' })}
                onDeleteTransaction={handleDeleteTransaction}
                onSaveTransactionsBatch={handleSaveTransactionsBatch}
              />
            ) : (
              snapshot && (
                <SnapshotManagerView
                  snapshot={snapshot}
                  instruments={instruments}
                  onSaveSnapshot={handleSaveSnapshot}
                  onResetDefaultSnapshot={handleResetDefaultSnapshot}
                />
              )
            )}
          </div>
        )}

        {/* Tab 3: Market Data & Valuation Ingestion */}
        {activeTab === 'marketData' && (
          <MarketDataView
            valuationDate={valuationDate}
            setValuationDate={setValuationDate}
            marketPrices={marketPrices}
            fxRates={fxRates}
            yieldCurves={yieldCurves}
            instruments={instruments}
            onSavePrices={handleSavePrices}
            onSaveFxRates={handleSaveFxRates}
            onSaveYieldCurves={handleSaveYieldCurves}
          />
        )}

        {/* Tab 4: SQLite Database Console & Query Runner */}
        {activeTab === 'sqlite' && (
          <SqliteInspectorView
            onExportSqlite={handleExportSqlite}
            onResetData={handleResetData}
          />
        )}
      </main>

      {/* Trade Modal */}
      <LogTransactionModal
        isOpen={tradeModal.isOpen}
        onClose={() => setTradeModal({ isOpen: false })}
        onSave={handleSaveTransaction}
        instruments={instruments}
        snapshotDate={snapshot?.snapshotDate || '2025-12-31'}
        defaultIsin={tradeModal.defaultIsin}
        defaultType={tradeModal.defaultType}
      />

      {/* Instrument Detail Specs Modal */}
      <InstrumentDetailModal
        instrument={selectedInstrument}
        onClose={() => setSelectedInstrument(null)}
        valuationDate={valuationDate}
        onTradeClick={handleTradeInstrument}
      />
    </div>
  );
}
