/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { sqliteService } from '../services/sqliteStorage';
import {
  Database,
  Play,
  Terminal,
  Download,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Table as TableIcon,
} from 'lucide-react';

interface SqliteInspectorViewProps {
  onExportSqlite: () => void;
  onResetData: () => void;
}

export const SqliteInspectorView: React.FC<SqliteInspectorViewProps> = ({
  onExportSqlite,
  onResetData,
}) => {
  const [query, setQuery] = useState<string>(
    'SELECT type, count(*) as count, sum(gross_amount) as total_gross FROM transactions GROUP BY type;'
  );
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[][];
    error?: string;
  } | null>(null);

  const sampleQueries = [
    {
      label: 'Transactions Summary by Type',
      sql: 'SELECT type, count(*) as trade_count, round(sum(gross_amount), 2) as total_gross, currency FROM transactions GROUP BY type, currency;',
    },
    {
      label: 'All Ledgered Trades Post-T0',
      sql: 'SELECT id, trade_date, isin, type, quantity, price, gross_amount, currency FROM transactions ORDER BY trade_date ASC;',
    },
    {
      label: 'Opening Snapshot Positions (T_0)',
      sql: 'SELECT isin, quantity, book_price, accrued_interest_t0, currency FROM snapshot_positions ORDER BY isin;',
    },
    {
      label: 'All Instruments in Catalog',
      sql: 'SELECT isin, issuer, currency, asset_class, credit_rating, sector FROM instruments ORDER BY asset_class;',
    },
    {
      label: 'Market Clean Prices Matrix',
      sql: 'SELECT isin, clean_price, source, as_of_date FROM market_prices ORDER BY isin;',
    },
  ];

  const handleRunQuery = () => {
    if (!query.trim()) return;
    const res = sqliteService.executeCustomSql(query);
    setQueryResult(res);
  };

  return (
    <div className="space-y-4">
      {/* Overview & SQLite Engine Card */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-tight">
              Local SQLite Database Console & Query Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Production-grade SQLite WASM engine executing transactional SQL queries locally with zero network latency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportSqlite}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Download .sqlite File</span>
          </button>

          <button
            onClick={onResetData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Re-seed Tables</span>
          </button>
        </div>
      </div>

      {/* Schema Tables Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { name: 'instruments', desc: 'Catalog of 5 Asset Classes' },
          { name: 'snapshot_positions', desc: 'Opening T_0 Holdings' },
          { name: 'transactions', desc: 'Post-T_0 Audit Ledger' },
          { name: 'market_prices', desc: 'Clean Prices & NAVs' },
        ].map((tbl) => (
          <div key={tbl.name} className="bg-slate-900 border border-slate-800 p-3 rounded text-xs font-mono">
            <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
              <TableIcon className="w-3.5 h-3.5" />
              <span>{tbl.name}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-sans mt-0.5">{tbl.desc}</div>
          </div>
        ))}
      </div>

      {/* Interactive SQL Query Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 font-mono">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>SQL QUERY RUNNER</span>
          </div>

          {/* Quick query buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] font-mono text-slate-500">Presets:</span>
            {sampleQueries.map((sq, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(sq.sql);
                  const res = sqliteService.executeCustomSql(sq.sql);
                  setQueryResult(res);
                }}
                className="px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 font-mono text-[10px] transition-colors whitespace-nowrap shrink-0"
              >
                {sq.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text Area */}
        <div className="p-3 bg-slate-950">
          <textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950 font-mono text-xs text-emerald-300 focus:outline-none resize-none leading-relaxed p-1"
            placeholder="Type arbitrary SQL query e.g. SELECT * FROM transactions..."
          />
        </div>

        {/* Query Run Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Direct SQLite execution against in-memory WASM database
          </span>
          <button
            onClick={handleRunQuery}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold font-mono transition-colors shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Execute SQL</span>
          </button>
        </div>
      </div>

      {/* Query Result Table */}
      {queryResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
            <span className="text-xs font-mono text-slate-300">
              Query Result: {queryResult.rows.length} row(s) returned
            </span>
            {queryResult.error && (
              <span className="text-xs font-mono text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Error encountered</span>
              </span>
            )}
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800 select-none">
                  {queryResult.columns.map((col, idx) => (
                    <th key={idx} className="py-2 px-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {queryResult.rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-800/40">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="py-2 px-3 text-slate-200">
                        {typeof cell === 'number'
                          ? cell.toLocaleString('en-US')
                          : cell !== null && cell !== undefined
                          ? String(cell)
                          : 'NULL'}
                      </td>
                    ))}
                  </tr>
                ))}
                {queryResult.rows.length === 0 && (
                  <tr>
                    <td colSpan={queryResult.columns.length} className="py-6 text-center text-slate-500">
                      Empty result set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
