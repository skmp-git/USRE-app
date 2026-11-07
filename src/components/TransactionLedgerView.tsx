/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  Currency,
  Transaction,
  TransactionType,
  Instrument,
} from '../types/portfolio';
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Filter,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  FileCheck2,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface TransactionLedgerViewProps {
  transactions: Transaction[];
  instruments: Instrument[];
  snapshotDate: string;
  onAddTransactionClick: () => void;
  onDeleteTransaction: (id: string) => void;
  onSaveTransactionsBatch: (transactions: Transaction[], replaceExisting: boolean) => void;
}

interface UploadedFileSummary {
  id: string;
  fileName: string;
  fileSize: number;
  parsedTransactions: Transaction[];
  errors: string[];
  warnings: string[];
}

export const TransactionLedgerView: React.FC<TransactionLedgerViewProps> = ({
  transactions,
  instruments,
  snapshotDate,
  onAddTransactionClick,
  onDeleteTransaction,
  onSaveTransactionsBatch,
}) => {
  const [activeTab, setActiveTab] = useState<'ledger' | 'batchUpload'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Batch upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileSummary[]>([]);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [commitFeedback, setCommitFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const types = ['ALL', 'BUY', 'SELL', 'COUPON', 'REDEMPTION', 'FEE'];

  const instMap = useMemo(() => {
    const map = new Map<string, Instrument>();
    for (const i of instruments) {
      map.set(i.isin, i);
    }
    return map;
  }, [instruments]);

  // Filtered transactions for the ledger table
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const q = searchQuery.toLowerCase().trim();
      const inst = instMap.get(tx.isin);
      const instName = inst ? inst.name.toLowerCase() : '';
      const notes = (tx.notes || '').toLowerCase();

      const matchesSearch =
        !q ||
        tx.isin.toLowerCase().includes(q) ||
        instName.includes(q) ||
        notes.includes(q) ||
        (tx.counterparty || '').toLowerCase().includes(q);

      const matchesType = selectedType === 'ALL' || tx.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [transactions, searchQuery, selectedType, instMap]);

  const formatNumber = (num: number, decimals: number = 2) => {
    return (num || 0).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Robust CSV parser supporting quotes and varied header names
  const parseCsvLines = (text: string): string[][] => {
    const lines: string[][] = [];
    let currentLine: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentLine.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentLine.push(currentField.trim());
        if (currentLine.some((f) => f.length > 0)) {
          lines.push(currentLine);
        }
        currentLine = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentLine.length > 0) {
      currentLine.push(currentField.trim());
      if (currentLine.some((f) => f.length > 0)) {
        lines.push(currentLine);
      }
    }

    return lines;
  };

  const parseTransactionCsv = (
    fileName: string,
    fileSize: number,
    csvContent: string
  ): UploadedFileSummary => {
    const rawRows = parseCsvLines(csvContent);
    const parsedTransactions: Transaction[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (rawRows.length < 2) {
      return {
        id: `${fileName}_${Date.now()}`,
        fileName,
        fileSize,
        parsedTransactions: [],
        errors: ['File is empty or contains no data rows.'],
        warnings: [],
      };
    }

    // Map headers to normalized keys
    const headers = rawRows[0].map((h) => h.toLowerCase().replace(/[\s_-]+/g, ''));
    const getIndex = (aliases: string[]) => {
      for (const a of aliases) {
        const clean = a.toLowerCase().replace(/[\s_-]+/g, '');
        const idx = headers.indexOf(clean);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const isinIdx = getIndex(['isin', 'security', 'ticker', 'securityid']);
    const typeIdx = getIndex(['type', 'action', 'transactiontype', 'activity']);
    const tradeDateIdx = getIndex(['tradedate', 'trade_date', 'date', 'orderdate']);
    const settleDateIdx = getIndex(['settlementdate', 'settledate', 'valuedate']);
    const qtyIdx = getIndex(['quantity', 'qty', 'par', 'units', 'shares', 'nominal']);
    const priceIdx = getIndex(['price', 'cleanprice', 'clean_price', 'nav', 'executionprice']);
    const accruedIdx = getIndex(['accruedinterestpct', 'accruedinterest', 'accrued', 'accruedpct']);
    const grossIdx = getIndex(['grossamount', 'gross']);
    const netIdx = getIndex(['netamount', 'net', 'settlementamount', 'cashamount']);
    const ccyIdx = getIndex(['currency', 'ccy']);
    const counterpartyIdx = getIndex(['counterparty', 'broker', 'dealer', 'desk']);
    const feeIdx = getIndex(['fee', 'fees', 'commission']);
    const notesIdx = getIndex(['notes', 'description', 'rationale', 'comment']);
    const idIdx = getIndex(['id', 'txid', 'transactionid']);

    if (isinIdx === -1 && typeIdx === -1) {
      return {
        id: `${fileName}_${Date.now()}`,
        fileName,
        fileSize,
        parsedTransactions: [],
        errors: ['Header row does not contain recognized columns like ISIN or Transaction Type.'],
        warnings: [],
      };
    }

    for (let r = 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (row.length === 0 || row.every((c) => !c)) continue; // skip blank rows

      const isin = isinIdx !== -1 && row[isinIdx] ? row[isinIdx].toUpperCase().trim() : '';
      if (!isin) {
        errors.push(`Row ${r + 1}: Missing ISIN code.`);
        continue;
      }

      // Catalog lookup
      const inst = instMap.get(isin);
      if (!inst) {
        warnings.push(`Row ${r + 1} (${isin}): ISIN not currently in instruments catalog (will still be imported).`);
      }

      // Type parsing
      let rawType = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toUpperCase().trim() : 'BUY';
      let type: TransactionType = 'BUY';
      if (['BUY', 'SELL', 'COUPON', 'REDEMPTION', 'FEE'].includes(rawType)) {
        type = rawType as TransactionType;
      } else if (rawType.startsWith('PURCHASE')) {
        type = 'BUY';
      } else if (rawType.startsWith('DIVIDEND') || rawType.startsWith('INTEREST')) {
        type = 'COUPON';
      } else if (rawType.startsWith('CALL') || rawType.startsWith('MATURITY')) {
        type = 'REDEMPTION';
      } else {
        warnings.push(`Row ${r + 1}: Unrecognized type "${rawType}", defaulted to BUY.`);
      }

      // Dates
      const tradeDate = tradeDateIdx !== -1 && row[tradeDateIdx] ? row[tradeDateIdx].trim() : snapshotDate;
      const settlementDate =
        settleDateIdx !== -1 && row[settleDateIdx] ? row[settleDateIdx].trim() : tradeDate;

      if (tradeDate < snapshotDate) {
        warnings.push(`Row ${r + 1} (${isin}): Trade date (${tradeDate}) is on or before T_0 inception snapshot date (${snapshotDate}).`);
      }

      // Quantities & Prices
      const quantity = qtyIdx !== -1 && row[qtyIdx] ? Math.abs(parseFloat(row[qtyIdx].replace(/[$,]/g, '')) || 0) : 0;
      let price = priceIdx !== -1 && row[priceIdx] ? parseFloat(row[priceIdx].replace(/[$,%]/g, '')) || 100 : 100;
      const accruedPct =
        accruedIdx !== -1 && row[accruedIdx] ? parseFloat(row[accruedIdx].replace(/[$,%]/g, '')) || 0 : 0;
      const fee = feeIdx !== -1 && row[feeIdx] ? parseFloat(row[feeIdx].replace(/[$,]/g, '')) || 0 : 0;

      // Currency
      let ccy = ccyIdx !== -1 && row[ccyIdx] ? row[ccyIdx].toUpperCase().trim() : '';
      if (!ccy) {
        ccy = inst ? inst.currency : 'USD';
      }

      // Gross Amount
      let gross =
        grossIdx !== -1 && row[grossIdx]
          ? parseFloat(row[grossIdx].replace(/[$,]/g, ''))
          : 0;
      if (!gross || isNaN(gross)) {
        if (inst?.assetClass === 'MutualFund') {
          gross = quantity * price;
        } else {
          // Standard clean par percentage
          gross = quantity * (price / 100);
        }
      }

      // Net Amount
      let net =
        netIdx !== -1 && row[netIdx]
          ? parseFloat(row[netIdx].replace(/[$,]/g, ''))
          : 0;
      if (!net || isNaN(net)) {
        const accruedCash = quantity * (accruedPct / 100);
        if (type === 'BUY') {
          net = gross + accruedCash + fee;
        } else if (type === 'SELL') {
          net = gross + accruedCash - fee;
        } else if (type === 'COUPON') {
          net = accruedCash > 0 ? accruedCash - fee : gross - fee;
        } else if (type === 'REDEMPTION') {
          net = gross - fee;
        } else if (type === 'FEE') {
          net = fee > 0 ? fee : gross;
        }
      }

      const counterparty =
        counterpartyIdx !== -1 && row[counterpartyIdx] ? row[counterpartyIdx].trim() : 'CSV Import';
      const notes =
        notesIdx !== -1 && row[notesIdx]
          ? row[notesIdx].trim()
          : `Batch imported from ${fileName}`;

      const id =
        idIdx !== -1 && row[idIdx]
          ? row[idIdx].trim()
          : `TX-${tradeDate.replace(/-/g, '')}-${isin.slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      parsedTransactions.push({
        id,
        tradeDate,
        settlementDate,
        isin,
        type,
        quantity,
        price,
        accruedInterestPct: accruedPct,
        grossAmount: Math.abs(gross),
        netAmount: Math.abs(net),
        currency: ccy,
        counterparty,
        fee,
        notes,
      });
    }

    return {
      id: `${fileName}_${Date.now()}`,
      fileName,
      fileSize,
      parsedTransactions,
      errors,
      warnings,
    };
  };

  // Handle file reading for multiple files
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(
      (f) => f.name.endsWith('.csv') || f.type === 'text/csv' || f.type.includes('csv')
    );

    if (fileArray.length === 0) {
      setCommitFeedback({
        message: 'Please select valid .csv files for batch upload.',
        type: 'error',
      });
      return;
    }

    let completed = 0;
    const newSummaries: UploadedFileSummary[] = [];

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) || '';
        const summary = parseTransactionCsv(file.name, file.size, text);
        newSummaries.push(summary);
        completed++;

        if (completed === fileArray.length) {
          setUploadedFiles((prev) => [...prev, ...newSummaries]);
          setCommitFeedback({
            message: `Processed ${fileArray.length} file(s). Review parsed transactions below before committing.`,
            type: 'success',
          });
        }
      };
      reader.onerror = () => {
        completed++;
        newSummaries.push({
          id: `${file.name}_${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          parsedTransactions: [],
          errors: [`Failed to read file ${file.name}.`],
          warnings: [],
        });
        if (completed === fileArray.length) {
          setUploadedFiles((prev) => [...prev, ...newSummaries]);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleClearAllFiles = () => {
    setUploadedFiles([]);
    setCommitFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Aggregated parsed transactions from all uploaded files
  const allParsedTransactions = useMemo(() => {
    return uploadedFiles.flatMap((f) => f.parsedTransactions);
  }, [uploadedFiles]);

  const allWarnings = useMemo(() => {
    return uploadedFiles.flatMap((f) => f.warnings);
  }, [uploadedFiles]);

  const allErrors = useMemo(() => {
    return uploadedFiles.flatMap((f) => f.errors);
  }, [uploadedFiles]);

  const handleCommitParsedBatch = () => {
    if (allParsedTransactions.length === 0) {
      setCommitFeedback({
        message: 'No valid transactions to commit. Please check uploaded files.',
        type: 'error',
      });
      return;
    }

    onSaveTransactionsBatch(allParsedTransactions, replaceExisting);
    setCommitFeedback({
      message: `Successfully committed ${allParsedTransactions.length} transactions into SQLite ledger (${replaceExisting ? 'Replaced existing' : 'Appended to existing'}).`,
      type: 'success',
    });
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Switch to ledger view after committing
    setTimeout(() => {
      setActiveTab('ledger');
    }, 1200);
  };

  // Download Sample Templates
  const downloadTemplate = (type: 'all' | 'trades' | 'cashflows' | 'catalog') => {
    let content = '';
    let filename = '';

    if (type === 'all') {
      filename = 'transactions_ledger_template.csv';
      content = [
        'ISIN,Type,Trade_Date,Settlement_Date,Quantity,Price,Accrued_Interest_Pct,Fee,Currency,Counterparty,Notes',
        'US91282CDP39,BUY,2026-01-15,2026-01-17,500000,99.85,0.425,50.00,USD,Tradeweb,Benchmark duration rebalancing addition',
        'IE00B875XS45,BUY,2026-02-10,2026-02-12,5000,11.25,0.000,15.00,USD,FundDirect,High yield mutual fund subscription',
        'US037833DV77,COUPON,2026-05-04,2026-05-04,500000,100.00,1.925,0.00,USD,BNY Mellon,Semi-annual coupon interest receipt',
        'DE0001102614,SELL,2026-06-18,2026-06-20,200000,101.40,0.180,75.00,EUR,Deutsche Bank,Curve flattening profit taking trim',
        'US9128203K55,REDEMPTION,2026-08-15,2026-08-15,250000,100.00,0.000,0.00,USD,Depository,Contractual principal strip maturity',
        'US91282CDP39,FEE,2026-09-30,2026-09-30,0,0,0.000,120.00,USD,Euroclear,Quarterly depository custody fee',
      ].join('\n');
    } else if (type === 'trades') {
      filename = 'trades_buy_sell_blotter_template.csv';
      content = [
        'ISIN,Type,Trade_Date,Settlement_Date,Quantity,Price,Accrued_Interest_Pct,Fee,Counterparty,Notes',
        'US91282CDP39,BUY,2026-01-20,2026-01-22,1000000,99.75,0.250,100.00,Morgan Stanley,Auction secondary purchase',
        'DE0001102614,SELL,2026-03-15,2026-03-17,300000,101.20,0.120,60.00,BNP Paribas,Duration de-risking',
        'XS2558394012,BUY,2026-04-10,2026-04-12,500000,100.00,0.000,50.00,UBS AG,Structured floater note addition',
      ].join('\n');
    } else if (type === 'cashflows') {
      filename = 'cashflows_coupons_redemptions_template.csv';
      content = [
        'ISIN,Type,Trade_Date,Settlement_Date,Quantity,Price,Accrued_Interest_Pct,Gross_Amount,Net_Amount,Currency,Notes',
        'US91282CDP39,COUPON,2026-05-15,2026-05-15,1000000,0,2.125,21250.00,21250.00,USD,Semi-annual coupon distribution',
        'DE0001102614,COUPON,2026-08-15,2026-08-15,1000000,0,2.600,26000.00,26000.00,EUR,Annual coupon distribution',
        'US9128203K55,REDEMPTION,2026-08-15,2026-08-15,500000,100.00,0.000,500000.00,500000.00,USD,Principal par redemption at maturity',
      ].join('\n');
    } else {
      filename = 'active_instruments_catalog_transactions.csv';
      const sampleRows = instruments.slice(0, 8).map((inst, idx) => {
        const txType = idx % 3 === 0 ? 'BUY' : idx % 3 === 1 ? 'COUPON' : 'SELL';
        const qty = inst.assetClass === 'MutualFund' ? 5000 : 250000;
        const price = inst.assetClass === 'MutualFund' ? 12.5 : 100.15;
        const accrued = inst.assetClass === 'DirectBond' ? 0.35 : 0.0;
        const date = `2026-0${Math.min(idx + 1, 9)}-15`;
        return `${inst.isin},${txType},${date},${date},${qty},${price},${accrued},25.00,${inst.currency},Desk-${idx + 1},Sample trade for ${inst.name.replace(/,/g, '')}`;
      });
      content = [
        'ISIN,Type,Trade_Date,Settlement_Date,Quantity,Price,Accrued_Interest_Pct,Fee,Currency,Counterparty,Notes',
        ...sampleRows,
      ].join('\n');
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
      {/* View Switcher Bar */}
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'ledger'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Transaction Ledger ({transactions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('batchUpload')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-medium text-xs transition-colors ${
              activeTab === 'batchUpload'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Batch CSV Ingestion & Templates</span>
            {uploadedFiles.length > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-full">
                {uploadedFiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Quick Action in Header */}
        <div className="flex items-center gap-2">
          {activeTab === 'ledger' ? (
            <button
              onClick={onAddTransactionClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Single Transaction</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('ledger')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition-colors"
            >
              <span>Back to Ledger</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {commitFeedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            commitFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {commitFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{commitFeedback.message}</span>
          </div>
          <button
            onClick={() => setCommitFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: TRANSACTION LEDGER TABLE                                         */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          {/* Top Filter Bar */}
          <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/70">
            <div className="flex items-center gap-3">
              <div className="relative min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search transactions by ISIN, security, notes, broker..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-9 pr-3 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-2.5 py-1 rounded font-mono font-medium text-[11px] transition-colors whitespace-nowrap shrink-0 ${
                      selectedType === t
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('batchUpload')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-indigo-700/50 rounded text-xs font-medium transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV Batch</span>
              </button>
            </div>
          </div>

          {/* High Density Transaction Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                  <th className="py-2.5 px-3">TX ID</th>
                  <th className="py-2.5 px-3">TRADE DATE</th>
                  <th className="py-2.5 px-3">SETTLE DATE</th>
                  <th className="py-2.5 px-2 text-center">TYPE</th>
                  <th className="py-2.5 px-3">SECURITY / ISIN</th>
                  <th className="py-2.5 px-3 text-right">PAR / UNITS</th>
                  <th className="py-2.5 px-3 text-right">PRICE (%)</th>
                  <th className="py-2.5 px-2 text-right">ACCRUED</th>
                  <th className="py-2.5 px-3 text-right">NET SETTLEMENT</th>
                  <th className="py-2.5 px-2">CCY</th>
                  <th className="py-2.5 px-3">COUNTERPARTY</th>
                  <th className="py-2.5 px-4">NOTES & RATIONALE</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {filtered.map((tx) => {
                  const inst = instMap.get(tx.isin);
                  const isCashIn =
                    tx.type === 'SELL' || tx.type === 'COUPON' || tx.type === 'REDEMPTION';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* ID */}
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">
                        {tx.id}
                      </td>

                      {/* Trade Date */}
                      <td className="py-2.5 px-3 text-slate-300 font-mono">{tx.tradeDate}</td>

                      {/* Settlement Date */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {tx.settlementDate}
                      </td>

                      {/* Type Badge */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.type === 'BUY'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : tx.type === 'SELL'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              : tx.type === 'COUPON'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                              : tx.type === 'REDEMPTION'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>

                      {/* Security Name & ISIN */}
                      <td className="py-2.5 px-3 font-sans">
                        <div
                          className="font-semibold text-slate-100 truncate max-w-[200px]"
                          title={inst?.name || tx.isin}
                        >
                          {inst?.name || tx.isin}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{tx.isin}</div>
                      </td>

                      {/* Par / Units */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {tx.quantity > 0 ? formatNumber(tx.quantity, 0) : '—'}
                      </td>

                      {/* Price */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {tx.price > 0 ? formatNumber(tx.price, 3) : '—'}
                      </td>

                      {/* Accrued */}
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {tx.accruedInterestPct ? `${formatNumber(tx.accruedInterestPct, 3)}%` : '—'}
                      </td>

                      {/* Net Amount */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        <span className={isCashIn ? 'text-emerald-400' : 'text-rose-400'}>
                          {isCashIn ? '+' : '-'}
                          {formatNumber(tx.netAmount, 2)}
                        </span>
                      </td>

                      {/* Currency */}
                      <td className="py-2.5 px-2 text-slate-400 font-mono">{tx.currency}</td>

                      {/* Counterparty */}
                      <td
                        className="py-2.5 px-3 text-slate-400 font-sans truncate max-w-[140px]"
                        title={tx.counterparty}
                      >
                        {tx.counterparty || '—'}
                      </td>

                      {/* Notes */}
                      <td
                        className="py-2.5 px-4 text-slate-400 font-sans truncate max-w-[220px]"
                        title={tx.notes}
                      >
                        {tx.notes || '—'}
                      </td>

                      {/* Delete Action */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Delete transaction and recompute state"
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500 font-sans">
                      No transactions recorded matching the active filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <div>
              Showing {filtered.length} of {transactions.length} ledgered transactions strictly after T_0 ({snapshotDate})
            </div>
            <div className="text-slate-400">
              State reconstructed dynamically per trade sequence
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: BATCH CSV INGESTION DESK & TEMPLATES                             */}
      {/* ========================================================================= */}
      {activeTab === 'batchUpload' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <span>Transaction Batch CSV Ingestion Desk</span>
                <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded font-mono">
                  MULTI-FILE READY
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload one or multiple CSV files simultaneously (trades blotters, coupon cashflows, redemption lists). Save time logging positions one by one.
              </p>
            </div>

            {/* Ingestion Mode Toggle */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] px-1 font-mono">Ingestion Mode:</span>
              <button
                onClick={() => setReplaceExisting(false)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  !replaceExisting
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Append to Ledger
              </button>
              <button
                onClick={() => setReplaceExisting(true)}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  replaceExisting
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Wipes existing post-T_0 transactions and replaces with the uploaded batch"
              >
                Replace Entire Ledger
              </button>
            </div>
          </div>

          {/* Multiple Files Drag & Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all bg-slate-950 ${
              isDragging
                ? 'border-indigo-500 bg-indigo-950/20'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-100">
              Drag & Drop Multiple Transaction CSV Files Here
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Select one or more trade blotters, execution logs, or corporate action files. The parser automatically validates dates, ISINs, prices, and net settlements.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold cursor-pointer shadow-sm transition-colors flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Browse Multiple CSV Files</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 font-mono">
              Accepts comma-separated (.csv) files • Quotes supported • Automatic currency and net amount calculation
            </p>
          </div>

          {/* Uploaded Files Summary Card List */}
          {uploadedFiles.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase font-mono tracking-wide flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>Staged File Batch ({uploadedFiles.length} files, {allParsedTransactions.length} total rows)</span>
                </span>
                <button
                  onClick={handleClearAllFiles}
                  className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Batch</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 flex flex-col justify-between space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 truncate" title={file.fileName}>
                          {file.fileName}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                        title="Remove file"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/40">
                      <span>{(file.fileSize / 1024).toFixed(1)} KB</span>
                      <span className="font-semibold text-emerald-400">
                        {file.parsedTransactions.length} rows parsed
                      </span>
                    </div>

                    {file.errors.length > 0 && (
                      <div className="text-[10px] text-rose-400 bg-rose-950/40 p-1.5 rounded border border-rose-900/60">
                        {file.errors[0]}
                      </div>
                    )}
                    {file.warnings.length > 0 && file.errors.length === 0 && (
                      <div className="text-[10px] text-amber-400 bg-amber-950/40 p-1 rounded truncate" title={file.warnings.join(' | ')}>
                        {file.warnings.length} warning(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Commit Action Strip */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 p-3 rounded-lg">
                <div className="text-xs font-mono text-slate-300">
                  Ready to commit <span className="font-bold text-indigo-400">{allParsedTransactions.length}</span> transactions into SQLite ledger.
                  {replaceExisting && (
                    <span className="text-rose-400 font-bold ml-2">
                      [Warning: Will replace existing {transactions.length} records]
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearAllFiles}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitParsedBatch}
                    disabled={allParsedTransactions.length === 0}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Commit All {allParsedTransactions.length} Transactions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Staged Parsed Transactions Preview Table */}
          {allParsedTransactions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase font-mono">
                  Parsed Batch Preview ({allParsedTransactions.length} Staged Rows)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Review values before final database commitment
                </span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 z-10">
                    <tr className="text-slate-400 font-mono text-[11px] border-b border-slate-800">
                      <th className="py-2 px-3">TRADE DATE</th>
                      <th className="py-2 px-3">SETTLE DATE</th>
                      <th className="py-2 px-2 text-center">TYPE</th>
                      <th className="py-2 px-3">ISIN / SECURITY</th>
                      <th className="py-2 px-3 text-right">PAR / UNITS</th>
                      <th className="py-2 px-3 text-right">PRICE (%)</th>
                      <th className="py-2 px-2 text-right">ACCRUED</th>
                      <th className="py-2 px-3 text-right">NET SETTLEMENT</th>
                      <th className="py-2 px-2">CCY</th>
                      <th className="py-2 px-3">COUNTERPARTY</th>
                      <th className="py-2 px-3">NOTES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {allParsedTransactions.map((tx, idx) => {
                      const inst = instMap.get(tx.isin);
                      const isCashIn =
                        tx.type === 'SELL' || tx.type === 'COUPON' || tx.type === 'REDEMPTION';

                      return (
                        <tr key={`${tx.id}_${idx}`} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-slate-300">{tx.tradeDate}</td>
                          <td className="py-2 px-3 text-slate-400">{tx.settlementDate}</td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                tx.type === 'BUY'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                  : tx.type === 'SELL'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                  : tx.type === 'COUPON'
                                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className="font-semibold text-slate-200">
                              {inst?.name || tx.isin}
                            </span>
                            <span className="block text-[10px] text-slate-500 font-mono">
                              {tx.isin} {!inst && '(Uncataloged)'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {formatNumber(tx.quantity, 0)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-300">
                            {formatNumber(tx.price, 3)}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-400">
                            {tx.accruedInterestPct ? `${formatNumber(tx.accruedInterestPct, 3)}%` : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold">
                            <span className={isCashIn ? 'text-emerald-400' : 'text-rose-400'}>
                              {isCashIn ? '+' : '-'}
                              {formatNumber(tx.netAmount, 2)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-400">{tx.currency}</td>
                          <td className="py-2 px-3 text-slate-400 font-sans truncate max-w-[120px]">
                            {tx.counterparty}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-sans truncate max-w-[150px]">
                            {tx.notes}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Download CSV Templates Strip */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wide flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Download Standard Transaction CSV Templates</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Download ready-to-use CSV templates formatted with sample data or pre-populated with your current portfolio instruments.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => downloadTemplate('all')}
                className="flex flex-col items-start p-3 bg-slate-950 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-left transition-colors group"
              >
                <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold mb-1">
                  <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  <span>All-in-One Ledger</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Full schema covering BUY, SELL, COUPON, REDEMPTION, and FEE transactions.
                </p>
              </button>

              <button
                onClick={() => downloadTemplate('trades')}
                className="flex flex-col items-start p-3 bg-slate-950 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-left transition-colors group"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold mb-1">
                  <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  <span>Trades Blotter</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tailored for execution desks recording Purchases & Sales with par and prices.
                </p>
              </button>

              <button
                onClick={() => downloadTemplate('cashflows')}
                className="flex flex-col items-start p-3 bg-slate-950 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-left transition-colors group"
              >
                <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold mb-1">
                  <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  <span>Coupons & Calls</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Corporate action cashflows for coupon distributions, sinking funds & redemptions.
                </p>
              </button>

              <button
                onClick={() => downloadTemplate('catalog')}
                className="flex flex-col items-start p-3 bg-slate-950 hover:bg-slate-800/80 rounded-lg border border-slate-800 text-left transition-colors group"
              >
                <div className="flex items-center gap-2 text-amber-400 font-mono text-xs font-bold mb-1">
                  <Download className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                  <span>Active Catalog Sample</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pre-populated with ISINs and currencies from your active portfolio positions.
                </p>
              </button>
            </div>

            {/* CSV Specification Table */}
            <div className="pt-3 border-t border-slate-800 text-xs">
              <span className="text-[11px] font-bold text-slate-300 font-mono uppercase block mb-2">
                Accepted CSV Header Schema & Auto-Calculations
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono text-slate-400">
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">ISIN (Required)</span>
                  12-character identifier. e.g. US91282CDP39.
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Type (Required)</span>
                  BUY, SELL, COUPON, REDEMPTION, FEE.
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Trade_Date / Settle</span>
                  Format YYYY-MM-DD. Defaults to T_0 if blank.
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Quantity / Par</span>
                  Face value (e.g. 1,000,000) or fund units (5,000).
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Price (Clean %)</span>
                  Price per 100 par (e.g. 99.85) or fund unit NAV.
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Accrued_Interest_Pct</span>
                  % of par accrued (e.g. 0.425 for 0.425%).
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Net_Amount</span>
                  Optional: Auto-computed from par, price, accrued & fee.
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/60">
                  <span className="text-indigo-400 font-bold block">Currency (CCY)</span>
                  Optional: Automatically looked up from catalog.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
