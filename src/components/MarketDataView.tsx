/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Currency,
  MarketPrice,
  FxRate,
  YieldCurvePoint,
  Instrument,
} from '../types/portfolio';
import {
  Upload,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface MarketDataViewProps {
  valuationDate: string;
  setValuationDate: (date: string) => void;
  marketPrices: MarketPrice[];
  fxRates: FxRate[];
  yieldCurves: YieldCurvePoint[];
  instruments: Instrument[];
  onSavePrices: (prices: MarketPrice[]) => void;
  onSaveFxRates: (rates: FxRate[]) => void;
  onSaveYieldCurves: (curves: YieldCurvePoint[]) => void;
}

export const MarketDataView: React.FC<MarketDataViewProps> = ({
  valuationDate,
  setValuationDate,
  marketPrices,
  fxRates,
  yieldCurves,
  instruments,
  onSavePrices,
  onSaveFxRates,
  onSaveYieldCurves,
}) => {
  const [activeTab, setActiveTab] = useState<'prices' | 'fx' | 'curves' | 'upload'>('prices');
  const [editablePrices, setEditablePrices] = useState<MarketPrice[]>([...marketPrices]);
  const [editableFx, setEditableFx] = useState<FxRate[]>([...fxRates]);
  const [uploadFeedback, setUploadFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showAddPair, setShowAddPair] = useState<boolean>(false);
  const [newPair, setNewPair] = useState<string>('');
  const [newPairRate, setNewPairRate] = useState<number>(1.0);

  const instMap = new Map<string, Instrument>();
  for (const i of instruments) {
    instMap.set(i.isin, i);
  }

  // Detect missing prices
  const pricedIsins = new Set(editablePrices.map((p) => p.isin));
  const missingInstruments = instruments.filter((i) => !pricedIsins.has(i.isin));

  const handlePriceChange = (isin: string, field: 'cleanPrice' | 'bid' | 'ask', value: number) => {
    setEditablePrices((prev) =>
      prev.map((p) => (p.isin === isin ? { ...p, [field]: value } : p))
    );
  };

  const handleCommitPrices = () => {
    onSavePrices(editablePrices);
    setUploadFeedback({ message: 'Clean prices committed to SQLite market database.', type: 'success' });
  };

  const handleFxChange = (pair: string, rate: number) => {
    setEditableFx((prev) =>
      prev.map((r) => (r.pair === pair ? { ...r, rate } : r))
    );
  };

  const handleCommitFx = () => {
    onSaveFxRates(editableFx);
    setUploadFeedback({ message: 'FX rates committed to SQLite database.', type: 'success' });
  };

  const handleAddPair = () => {
    if (!newPair.trim() || !newPair.includes('/')) {
      alert('Please enter a valid currency pair format, e.g. USD/JPY or AUD/USD');
      return;
    }
    const cleanPair = newPair.toUpperCase().trim();
    const existing = editableFx.find((r) => r.pair === cleanPair);
    if (existing) {
      handleFxChange(cleanPair, newPairRate);
    } else {
      setEditableFx((prev) => [
        ...prev,
        { pair: cleanPair, rate: newPairRate, asOfDate: valuationDate },
      ]);
    }
    setNewPair('');
    setShowAddPair(false);
  };

  // CSV File Ingestion Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          throw new Error('CSV file is empty or missing data rows');
        }

        const header = lines[0].toLowerCase();

        // Check if Prices CSV
        if (header.includes('isin') && (header.includes('price') || header.includes('clean'))) {
          const parsed: MarketPrice[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            if (cols.length >= 2 && cols[0]) {
              parsed.push({
                isin: cols[0],
                cleanPrice: parseFloat(cols[1]) || 100.0,
                bid: cols[2] ? parseFloat(cols[2]) : undefined,
                ask: cols[3] ? parseFloat(cols[3]) : undefined,
                source: (cols[4] as any) || 'Tradeweb',
                asOfDate: cols[5] || valuationDate,
              });
            }
          }
          onSavePrices(parsed);
          setEditablePrices(parsed);
          setUploadFeedback({ message: `Successfully ingested ${parsed.length} security prices from CSV.`, type: 'success' });
        } else if (header.includes('pair') && header.includes('rate')) {
          // FX Rates CSV
          const parsed: FxRate[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            if (cols.length >= 2 && cols[0]) {
              parsed.push({
                pair: cols[0].toUpperCase(),
                rate: parseFloat(cols[1]) || 1.0,
                asOfDate: cols[2] || valuationDate,
              });
            }
          }
          onSaveFxRates(parsed);
          setEditableFx(parsed);
          setUploadFeedback({ message: `Successfully ingested ${parsed.length} FX rates from CSV.`, type: 'success' });
        } else {
          throw new Error('Unrecognized CSV format. Headers must include either (isin, clean_price) or (pair, rate).');
        }
      } catch (err: any) {
        setUploadFeedback({ message: `CSV Ingestion Error: ${err.message}`, type: 'error' });
      }
    };
    reader.readAsText(file);
  };

  // Download Sample Templates
  const downloadTemplate = (type: 'prices' | 'fx' | 'yields') => {
    let content = '';
    let filename = '';

    if (type === 'prices') {
      filename = 'market_prices_sample.csv';
      content =
        'ISIN,Clean_Price,Bid,Ask,Source,As_Of_Date\n' +
        instruments.map((i) => `${i.isin},100.25,100.20,100.30,Tradeweb,${valuationDate}`).join('\n');
    } else if (type === 'fx') {
      filename = 'fx_rates_sample.csv';
      content =
        'Pair,Rate,As_Of_Date\n' +
        'EUR/USD,1.0850,' + valuationDate + '\n' +
        'GBP/USD,1.2850,' + valuationDate + '\n' +
        'USD/CHF,0.8850,' + valuationDate + '\n' +
        'CHF/USD,1.1300,' + valuationDate + '\n';
    } else {
      filename = 'yield_curves_sample.csv';
      content =
        'Curve_ID,Tenor,Rate\n' +
        'UST,1M,0.0485\n' +
        'UST,3M,0.0475\n' +
        'UST,1Y,0.0435\n' +
        'UST,2Y,0.0415\n' +
        'UST,5Y,0.0405\n' +
        'UST,10Y,0.0428\n' +
        'UST,30Y,0.0452\n' +
        'SOFR,3M,0.0470\n';
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Valuation Date & Overview Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">
            Market Data & Valuation Ingestion Desk
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Maintain clean prices, NAVs, FX cross-rates, and benchmark yield curves for target date <span className="text-indigo-400 font-mono font-semibold">{valuationDate}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={valuationDate}
            onChange={(e) => e.target.value && setValuationDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white font-mono text-xs px-3 py-1.5 rounded focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Feedback Alert */}
      {uploadFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            uploadFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {uploadFeedback.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{uploadFeedback.message}</span>
        </div>
      )}

      {/* Missing Data Warning */}
      {missingInstruments.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-lg text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {missingInstruments.length} catalog instrument(s) missing market prices as of {valuationDate}.
            </span>
          </div>
          <button
            onClick={() => {
              const appended = [
                ...editablePrices,
                ...missingInstruments.map((m) => ({
                  isin: m.isin,
                  cleanPrice: 100.0,
                  bid: 99.8,
                  ask: 100.2,
                  source: 'Model' as const,
                  asOfDate: valuationDate,
                })),
              ];
              setEditablePrices(appended);
              onSavePrices(appended);
            }}
            className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-white font-medium rounded text-[11px] transition-colors"
          >
            Auto-Fill with Par (100.0)
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('prices')}
          className={`px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'prices' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Clean Prices & NAVs ({editablePrices.length})
        </button>
        <button
          onClick={() => setActiveTab('fx')}
          className={`px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'fx' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          FX Cross Rates ({editableFx.length})
        </button>
        <button
          onClick={() => setActiveTab('curves')}
          className={`px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'curves' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Yield Curves ({yieldCurves.length} points)
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-medium transition-colors ${
            activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CSV / Excel</span>
        </button>
      </div>

      {/* Sub-View 1: Clean Prices */}
      {activeTab === 'prices' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Direct Clean Prices & Mutual Fund NAVs as of {valuationDate}
            </span>
            <button
              onClick={handleCommitPrices}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors"
            >
              Save All Price Edits
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <th className="py-2 px-3">ISIN</th>
                  <th className="py-2 px-3">SECURITY NAME</th>
                  <th className="py-2 px-2">ASSET TYPE</th>
                  <th className="py-2 px-2">CCY</th>
                  <th className="py-2 px-3 text-right">CLEAN PRICE (% / NAV)</th>
                  <th className="py-2 px-3 text-right">BID</th>
                  <th className="py-2 px-3 text-right">ASK</th>
                  <th className="py-2 px-3">SOURCE</th>
                  <th className="py-2 px-3">AS OF DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {editablePrices.map((p) => {
                  const inst = instMap.get(p.isin);
                  return (
                    <tr key={p.isin} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-indigo-300">{p.isin}</td>
                      <td className="py-2 px-3 font-sans font-semibold text-slate-200">{inst?.name || p.isin}</td>
                      <td className="py-2 px-2 text-slate-400 font-sans">{inst?.assetClass}</td>
                      <td className="py-2 px-2 text-slate-400">{inst?.currency}</td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={p.cleanPrice}
                          onChange={(e) => handlePriceChange(p.isin, 'cleanPrice', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono font-bold text-white"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={p.bid || ''}
                          onChange={(e) => handlePriceChange(p.isin, 'bid', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono text-slate-300"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={p.ask || ''}
                          onChange={(e) => handlePriceChange(p.isin, 'ask', parseFloat(e.target.value) || 0)}
                          className="w-20 bg-slate-950 border border-slate-700 text-right p-1 rounded font-mono text-slate-300"
                        />
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans">{p.source}</td>
                      <td className="py-2 px-3 text-slate-400">{p.asOfDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-View 2: FX Rates */}
      {activeTab === 'fx' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              Foreign Exchange Currency Rates as of {valuationDate}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddPair(!showAddPair)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold rounded border border-indigo-700/50 transition-colors"
              >
                {showAddPair ? 'Cancel' : '+ Add Currency Pair'}
              </button>
              <button
                onClick={handleCommitFx}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Save FX Rates
              </button>
            </div>
          </div>

          {showAddPair && (
            <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center gap-3 text-xs font-mono">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">PAIR (e.g. USD/JPY)</label>
                <input
                  type="text"
                  placeholder="USD/JPY"
                  value={newPair}
                  onChange={(e) => setNewPair(e.target.value.toUpperCase())}
                  className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded w-28 uppercase"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">SPOT RATE</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newPairRate}
                  onChange={(e) => setNewPairRate(parseFloat(e.target.value) || 1.0)}
                  className="bg-slate-900 border border-slate-700 text-white px-2 py-1 rounded w-32"
                />
              </div>
              <button
                onClick={handleAddPair}
                className="mt-4 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs transition-colors"
              >
                Add / Update Pair
              </button>
            </div>
          )}

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {editableFx.map((fx) => (
              <div key={fx.pair} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                <div className="text-[11px] font-mono text-indigo-400 font-bold">{fx.pair}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.0001"
                    value={fx.rate}
                    onChange={(e) => handleFxChange(fx.pair, parseFloat(e.target.value) || 1.0)}
                    className="w-full bg-slate-900 border border-slate-700 text-white font-mono font-bold text-sm p-1.5 rounded"
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-mono">As of {fx.asOfDate}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub-View 3: Yield Curves */}
      {activeTab === 'curves' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-300">
              Benchmark Yield Curves (UST, SOFR, EURIBOR)
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {['UST', 'SOFR', 'EURIBOR'].map((cid) => {
              const points = yieldCurves.filter((c) => c.curveId === cid);
              return (
                <div key={cid} className="bg-slate-950 border border-slate-800 rounded p-3">
                  <div className="font-mono text-xs font-bold text-white mb-2 pb-1 border-b border-slate-800">
                    {cid === 'UST' ? 'US Treasury Curve' : cid === 'SOFR' ? 'SOFR Benchmark' : 'EURIBOR Curve'}
                  </div>
                  <div className="space-y-1.5 font-mono text-xs">
                    {points.map((pt) => (
                      <div key={pt.tenor} className="flex justify-between items-center text-slate-300">
                        <span className="text-slate-400">{pt.tenor}</span>
                        <span className="font-bold text-indigo-300">{(pt.rate * 100).toFixed(2)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-View 4: CSV Upload & Ingestion */}
      {activeTab === 'upload' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
          <div>
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide">
              Market Data File Upload & Schema Mapping
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Upload standard CSV files to update Clean Prices, Fund NAVs, or Foreign Exchange rates in bulk.
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-lg p-8 text-center transition-colors bg-slate-950">
            <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-200">
              Select or Drop CSV File (Clean Prices or FX Rates)
            </p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              Accepted formats: .csv with comma separation
            </p>
            <label className="mt-3 inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer shadow-xs transition-colors">
              <span>Browse CSV File</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Sample CSV Templates Download Strip */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2 font-mono">
              Download Standard CSV Templates:
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => downloadTemplate('prices')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-xs font-mono transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Clean Prices Template (.csv)</span>
              </button>

              <button
                onClick={() => downloadTemplate('fx')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-xs font-mono transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>FX Rates Template (.csv)</span>
              </button>

              <button
                onClick={() => downloadTemplate('yields')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-200 rounded border border-slate-800 text-xs font-mono transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Yield Curve Template (.csv)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
