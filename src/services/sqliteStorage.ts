/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Database } from 'sql.js';
import {
  Currency,
  Instrument,
  InceptionSnapshot,
  Transaction,
  MarketPrice,
  FxRate,
  YieldCurvePoint,
  SnapshotPosition,
} from '../types/portfolio';
import {
  SAMPLE_INSTRUMENTS,
  INITIAL_SNAPSHOT_T0,
  SAMPLE_TRANSACTIONS,
  SAMPLE_MARKET_PRICES,
  SAMPLE_FX_RATES,
  SAMPLE_YIELD_CURVES,
} from './sampleData';

const DB_STORAGE_KEY = 'fixed_income_portfolio_sqlite_v2';
const FALLBACK_STORAGE_KEY = 'fixed_income_portfolio_fallback_v2';

export interface RolledPositionState {
  isin: string;
  quantity: number;
  costBasis: number;
  costPrice: number;
  currency: Currency;
  firstAcquiredDate: string;
}

export interface RolledPortfolioState {
  targetDate: string;
  snapshotDate: string;
  positions: RolledPositionState[];
  cashBalances: Record<string, number>;
  transactionsApplied: number;
}

interface FallbackStore {
  instruments: Instrument[];
  snapshot: InceptionSnapshot | null;
  transactions: Transaction[];
  marketPrices: MarketPrice[];
  fxRates: FxRate[];
  yieldCurves: YieldCurvePoint[];
}

class SqlitePortfolioService {
  private db: Database | null = null;
  private isInitializing: Promise<void> | null = null;
  private isWasmActive: boolean = false;

  // Pre-seed fallback store with heritage portfolio data so state is immediately available
  private fallbackStore: FallbackStore = {
    instruments: [...SAMPLE_INSTRUMENTS],
    snapshot: INITIAL_SNAPSHOT_T0,
    transactions: [...SAMPLE_TRANSACTIONS],
    marketPrices: [...SAMPLE_MARKET_PRICES],
    fxRates: [...SAMPLE_FX_RATES],
    yieldCurves: [...SAMPLE_YIELD_CURVES],
  };

  public async init(): Promise<void> {
    if (this.db || this.isWasmActive) return;
    if (this.isInitializing) return this.isInitializing;

    this.isInitializing = new Promise<void>((resolve) => {
      // 1. First, load any saved fallback state from storage
      this.loadFallbackFromStorage();

      // 2. Safely attempt SQLite WebAssembly in background without blocking UI
      const attemptWasm = async () => {
        if (typeof window === 'undefined' || typeof WebAssembly === 'undefined') {
          return;
        }

        try {
          // Dynamic import prevents module evaluation crashes if WASM is blocked
          // @ts-ignore
          const sqlJsModule = await import('sql.js/dist/sql-wasm-inline.js');
          const initSqlJs = sqlJsModule.default || sqlJsModule;
          if (typeof initSqlJs !== 'function') return;

          const SQL = await initSqlJs({
            onAbort: (msg: any) => {
              console.warn('SQLite WASM aborted, relational engine active:', msg);
            },
          });

          if (!SQL || !SQL.Database) return;

          // Try restoring existing database from localStorage
          let restored = false;
          try {
            const savedBinary = window.localStorage ? localStorage.getItem(DB_STORAGE_KEY) : null;
            if (savedBinary) {
              const binaryArray = new Uint8Array(JSON.parse(savedBinary));
              this.db = new SQL.Database(binaryArray);
              this.ensureSchema();
              this.isWasmActive = true;
              restored = true;
            }
          } catch (e) {
            console.warn('Could not restore binary SQLite, initializing fresh:', e);
          }

          if (!restored) {
            this.db = new SQL.Database();
            this.ensureSchema();
            this.isWasmActive = true;
            this.syncFallbackToWasm();
          }
        } catch (wasmErr) {
          console.warn('WASM SQLite unavailable, continuing with built-in relational engine:', wasmErr);
          this.isWasmActive = false;
        }
      };

      // Execute with a short timeout so init() resolves immediately
      Promise.race([
        attemptWasm(),
        new Promise((r) => setTimeout(r, 400)),
      ]).finally(() => {
        resolve();
      });
    });

    return this.isInitializing;
  }

  private syncFallbackToWasm(): void {
    if (!this.db || !this.isWasmActive) return;
    try {
      if (this.fallbackStore.instruments.length > 0) {
        this.saveInstrumentsBatch(this.fallbackStore.instruments);
      }
      if (this.fallbackStore.snapshot) {
        this.setInceptionSnapshot(this.fallbackStore.snapshot);
      }
      for (const tx of this.fallbackStore.transactions) {
        this.addTransaction(tx);
      }
      if (this.fallbackStore.marketPrices.length > 0) {
        this.saveMarketPrices(this.fallbackStore.marketPrices);
      }
      if (this.fallbackStore.fxRates.length > 0) {
        this.saveFxRates(this.fallbackStore.fxRates);
      }
      if (this.fallbackStore.yieldCurves.length > 0) {
        this.saveYieldCurves(this.fallbackStore.yieldCurves);
      }
    } catch (e) {
      console.warn('Could not sync fallback store to SQLite WASM:', e);
    }
  }

  private loadFallbackFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(FALLBACK_STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (parsed && Array.isArray(parsed.instruments) && parsed.instruments.length > 0) {
            this.fallbackStore = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Could not read fallback store from localStorage:', e);
    }
  }

  private persistFallback(): void {
    try {
      localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(this.fallbackStore));
    } catch (e) {
      console.warn('Could not persist fallback store to localStorage:', e);
    }
  }

  private persist(): void {
    if (this.db && this.isWasmActive) {
      try {
        const binary = this.db.export();
        const jsonStr = JSON.stringify(Array.from(binary));
        localStorage.setItem(DB_STORAGE_KEY, jsonStr);
      } catch (err) {
        console.error('Failed to persist SQLite database to localStorage:', err);
      }
    } else {
      this.persistFallback();
    }
  }

  private ensureSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS instruments (
        isin TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        issuer TEXT NOT NULL,
        currency TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        credit_rating TEXT NOT NULL,
        sector TEXT NOT NULL,
        details_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snapshot_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        snapshot_date TEXT NOT NULL,
        portfolio_name TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS snapshot_positions (
        isin TEXT PRIMARY KEY,
        quantity REAL NOT NULL,
        book_price REAL NOT NULL,
        accrued_interest_t0 REAL NOT NULL,
        currency TEXT NOT NULL,
        acquisition_date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snapshot_cash (
        currency TEXT PRIMARY KEY,
        balance REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        trade_date TEXT NOT NULL,
        settlement_date TEXT NOT NULL,
        isin TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        accrued_interest_pct REAL DEFAULT 0,
        gross_amount REAL NOT NULL,
        net_amount REAL NOT NULL,
        currency TEXT NOT NULL,
        counterparty TEXT,
        fee REAL DEFAULT 0,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_tx_trade_date ON transactions(trade_date);
      CREATE INDEX IF NOT EXISTS idx_tx_isin ON transactions(isin);

      CREATE TABLE IF NOT EXISTS market_prices (
        isin TEXT PRIMARY KEY,
        clean_price REAL NOT NULL,
        bid REAL,
        ask REAL,
        source TEXT NOT NULL,
        as_of_date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fx_rates (
        pair TEXT PRIMARY KEY,
        rate REAL NOT NULL,
        as_of_date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS yield_curves (
        curve_id TEXT NOT NULL,
        tenor TEXT NOT NULL,
        rate REAL NOT NULL,
        PRIMARY KEY (curve_id, tenor)
      );
    `);
  }

  // 1. Inception Snapshot Operations
  public setInceptionSnapshot(snapshot: InceptionSnapshot): void {
    if (this.db && this.isWasmActive) {
      this.db.run('BEGIN TRANSACTION;');
      try {
        this.db.run(
          `INSERT OR REPLACE INTO snapshot_metadata (id, snapshot_date, portfolio_name, notes)
           VALUES (1, ?, ?, ?);`,
          [snapshot.snapshotDate, snapshot.portfolioName, snapshot.notes || '']
        );

        this.db.run('DELETE FROM snapshot_positions;');
        for (const pos of snapshot.positions) {
          this.db.run(
            `INSERT INTO snapshot_positions (isin, quantity, book_price, accrued_interest_t0, currency, acquisition_date)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [pos.isin, pos.quantity, pos.bookPrice, pos.accruedInterestT0, pos.currency, pos.acquisitionDate]
          );
        }

        this.db.run('DELETE FROM snapshot_cash;');
        for (const [ccy, bal] of Object.entries(snapshot.cashBalances)) {
          this.db.run(
            `INSERT INTO snapshot_cash (currency, balance) VALUES (?, ?);`,
            [ccy, bal]
          );
        }

        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (err) {
        this.db.run('ROLLBACK;');
        console.error('Error saving snapshot in SQLite:', err);
      }
    }

    // Fallback store
    this.fallbackStore.snapshot = JSON.parse(JSON.stringify(snapshot));
    this.persistFallback();
  }

  public getInceptionSnapshot(): InceptionSnapshot | null {
    if (this.db && this.isWasmActive) {
      try {
        const metaRes = this.db.exec('SELECT snapshot_date, portfolio_name, notes FROM snapshot_metadata WHERE id = 1;');
        if (metaRes.length && metaRes[0].values.length) {
          const [snapshotDate, portfolioName, notes] = metaRes[0].values[0] as [string, string, string];

          const posRes = this.db.exec(
            'SELECT isin, quantity, book_price, accrued_interest_t0, currency, acquisition_date FROM snapshot_positions;'
          );
          const positions: SnapshotPosition[] = [];
          if (posRes.length && posRes[0].values.length) {
            for (const row of posRes[0].values) {
              positions.push({
                isin: row[0] as string,
                quantity: row[1] as number,
                bookPrice: row[2] as number,
                accruedInterestT0: row[3] as number,
                currency: row[4] as Currency,
                acquisitionDate: row[5] as string,
              });
            }
          }

          const cashRes = this.db.exec('SELECT currency, balance FROM snapshot_cash;');
          const cashBalances: Record<string, number> = {};
          if (cashRes.length && cashRes[0].values.length) {
            for (const row of cashRes[0].values) {
              cashBalances[row[0] as string] = row[1] as number;
            }
          }

          return {
            snapshotDate,
            portfolioName,
            positions,
            cashBalances,
            notes,
          };
        }
      } catch (e) {
        console.warn('Error reading snapshot from SQLite, falling back:', e);
      }
    }

    return this.fallbackStore.snapshot ? JSON.parse(JSON.stringify(this.fallbackStore.snapshot)) : null;
  }

  // 2. Instrument Catalog Operations
  public saveInstrument(instrument: Instrument): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run(
          `INSERT OR REPLACE INTO instruments (isin, name, issuer, currency, asset_class, credit_rating, sector, details_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            instrument.isin,
            instrument.name,
            instrument.issuer,
            instrument.currency,
            instrument.assetClass,
            instrument.creditRating,
            instrument.sector,
            JSON.stringify(instrument),
          ]
        );
        this.persist();
        return;
      } catch (e) {
        console.warn('SQLite saveInstrument error, using fallback:', e);
      }
    }

    const idx = this.fallbackStore.instruments.findIndex((i) => i.isin === instrument.isin);
    if (idx >= 0) {
      this.fallbackStore.instruments[idx] = instrument;
    } else {
      this.fallbackStore.instruments.push(instrument);
    }
    this.persistFallback();
  }

  public saveInstrumentsBatch(instruments: Instrument[]): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run('BEGIN TRANSACTION;');
        for (const inst of instruments) {
          this.db.run(
            `INSERT OR REPLACE INTO instruments (isin, name, issuer, currency, asset_class, credit_rating, sector, details_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              inst.isin,
              inst.name,
              inst.issuer,
              inst.currency,
              inst.assetClass,
              inst.creditRating,
              inst.sector,
              JSON.stringify(inst),
            ]
          );
        }
        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (e) {
        this.db.run('ROLLBACK;');
        console.warn('SQLite batch instrument save error, using fallback:', e);
      }
    }

    for (const inst of instruments) {
      const idx = this.fallbackStore.instruments.findIndex((i) => i.isin === inst.isin);
      if (idx >= 0) {
        this.fallbackStore.instruments[idx] = inst;
      } else {
        this.fallbackStore.instruments.push(inst);
      }
    }
    this.persistFallback();
  }

  public getInstruments(): Instrument[] {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec('SELECT details_json FROM instruments ORDER BY issuer, name;');
        if (res.length && res[0].values.length) {
          return res[0].values.map((row) => JSON.parse(row[0] as string) as Instrument);
        }
      } catch (e) {
        console.warn('SQLite getInstruments error, using fallback:', e);
      }
    }

    return [...this.fallbackStore.instruments];
  }

  public getInstrument(isin: string): Instrument | null {
    const list = this.getInstruments();
    return list.find((i) => i.isin === isin) || null;
  }

  // 3. Transactions Operations
  public addTransaction(tx: Transaction): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run(
          `INSERT OR REPLACE INTO transactions
           (id, trade_date, settlement_date, isin, type, quantity, price, accrued_interest_pct, gross_amount, net_amount, currency, counterparty, fee, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            tx.id,
            tx.tradeDate,
            tx.settlementDate,
            tx.isin,
            tx.type,
            tx.quantity,
            tx.price,
            tx.accruedInterestPct || 0,
            tx.grossAmount,
            tx.netAmount,
            tx.currency,
            tx.counterparty || '',
            tx.fee || 0,
            tx.notes || '',
          ]
        );
        this.persist();
        return;
      } catch (e) {
        console.warn('SQLite addTransaction error, using fallback:', e);
      }
    }

    const idx = this.fallbackStore.transactions.findIndex((t) => t.id === tx.id);
    if (idx >= 0) {
      this.fallbackStore.transactions[idx] = tx;
    } else {
      this.fallbackStore.transactions.push(tx);
    }
    this.persistFallback();
  }

  public addTransactionsBatch(txs: Transaction[], replaceExisting: boolean = false): void {
    if (!txs || txs.length === 0) return;

    if (this.db && this.isWasmActive) {
      try {
        this.db.run('BEGIN TRANSACTION;');
        if (replaceExisting) {
          this.db.run('DELETE FROM transactions;');
        }
        for (const tx of txs) {
          this.db.run(
            `INSERT OR REPLACE INTO transactions
             (id, trade_date, settlement_date, isin, type, quantity, price, accrued_interest_pct, gross_amount, net_amount, currency, counterparty, fee, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              tx.id,
              tx.tradeDate,
              tx.settlementDate,
              tx.isin,
              tx.type,
              tx.quantity,
              tx.price,
              tx.accruedInterestPct || 0,
              tx.grossAmount,
              tx.netAmount,
              tx.currency,
              tx.counterparty || '',
              tx.fee || 0,
              tx.notes || '',
            ]
          );
        }
        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (e) {
        this.db.run('ROLLBACK;');
        console.warn('SQLite addTransactionsBatch error, using fallback:', e);
      }
    }

    if (replaceExisting) {
      this.fallbackStore.transactions = [...txs];
    } else {
      for (const tx of txs) {
        const idx = this.fallbackStore.transactions.findIndex((t) => t.id === tx.id);
        if (idx >= 0) {
          this.fallbackStore.transactions[idx] = tx;
        } else {
          this.fallbackStore.transactions.push(tx);
        }
      }
    }
    this.persistFallback();
  }

  public clearAllTransactions(): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run('DELETE FROM transactions;');
        this.persist();
        return;
      } catch (e) {
        console.warn('SQLite clearAllTransactions error, using fallback:', e);
      }
    }
    this.fallbackStore.transactions = [];
    this.persistFallback();
  }

  public deleteTransaction(id: string): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run(`DELETE FROM transactions WHERE id = ?;`, [id]);
        this.persist();
        return;
      } catch (e) {
        console.warn('SQLite deleteTransaction error, using fallback:', e);
      }
    }

    this.fallbackStore.transactions = this.fallbackStore.transactions.filter((t) => t.id !== id);
    this.persistFallback();
  }

  public getTransactions(): Transaction[] {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec(
          `SELECT id, trade_date, settlement_date, isin, type, quantity, price, accrued_interest_pct, gross_amount, net_amount, currency, counterparty, fee, notes
           FROM transactions ORDER BY trade_date DESC, settlement_date DESC;`
        );
        if (res.length && res[0].values.length) {
          return res[0].values.map((row) => ({
            id: row[0] as string,
            tradeDate: row[1] as string,
            settlementDate: row[2] as string,
            isin: row[3] as string,
            type: row[4] as Transaction['type'],
            quantity: row[5] as number,
            price: row[6] as number,
            accruedInterestPct: row[7] as number,
            grossAmount: row[8] as number,
            netAmount: row[9] as number,
            currency: row[10] as Currency,
            counterparty: row[11] as string,
            fee: row[12] as number,
            notes: row[13] as string,
          }));
        }
      } catch (e) {
        console.warn('SQLite getTransactions error, using fallback:', e);
      }
    }

    return [...this.fallbackStore.transactions].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
  }

  // 4. Market Data Operations
  public saveMarketPrices(prices: MarketPrice[]): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run('BEGIN TRANSACTION;');
        for (const p of prices) {
          this.db.run(
            `INSERT OR REPLACE INTO market_prices (isin, clean_price, bid, ask, source, as_of_date)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [p.isin, p.cleanPrice, p.bid ?? null, p.ask ?? null, p.source, p.asOfDate]
          );
        }
        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (e) {
        this.db.run('ROLLBACK;');
        console.warn('SQLite saveMarketPrices error, using fallback:', e);
      }
    }

    for (const p of prices) {
      const idx = this.fallbackStore.marketPrices.findIndex((x) => x.isin === p.isin);
      if (idx >= 0) {
        this.fallbackStore.marketPrices[idx] = p;
      } else {
        this.fallbackStore.marketPrices.push(p);
      }
    }
    this.persistFallback();
  }

  public getMarketPrices(): MarketPrice[] {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec('SELECT isin, clean_price, bid, ask, source, as_of_date FROM market_prices;');
        if (res.length && res[0].values.length) {
          return res[0].values.map((row) => ({
            isin: row[0] as string,
            cleanPrice: row[1] as number,
            bid: row[2] as number | undefined,
            ask: row[3] as number | undefined,
            source: row[4] as MarketPrice['source'],
            asOfDate: row[5] as string,
          }));
        }
      } catch (e) {
        console.warn('SQLite getMarketPrices error, using fallback:', e);
      }
    }

    return [...this.fallbackStore.marketPrices];
  }

  public saveFxRates(rates: FxRate[]): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run('BEGIN TRANSACTION;');
        for (const r of rates) {
          this.db.run(
            `INSERT OR REPLACE INTO fx_rates (pair, rate, as_of_date) VALUES (?, ?, ?);`,
            [r.pair, r.rate, r.asOfDate]
          );
        }
        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (e) {
        this.db.run('ROLLBACK;');
        console.warn('SQLite saveFxRates error, using fallback:', e);
      }
    }

    for (const r of rates) {
      const idx = this.fallbackStore.fxRates.findIndex((x) => x.pair === r.pair);
      if (idx >= 0) {
        this.fallbackStore.fxRates[idx] = r;
      } else {
        this.fallbackStore.fxRates.push(r);
      }
    }
    this.persistFallback();
  }

  public getFxRates(): FxRate[] {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec('SELECT pair, rate, as_of_date FROM fx_rates;');
        if (res.length && res[0].values.length) {
          return res[0].values.map((row) => ({
            pair: row[0] as string,
            rate: row[1] as number,
            asOfDate: row[2] as string,
          }));
        }
      } catch (e) {
        console.warn('SQLite getFxRates error, using fallback:', e);
      }
    }

    return [...this.fallbackStore.fxRates];
  }

  public saveYieldCurves(points: YieldCurvePoint[]): void {
    if (this.db && this.isWasmActive) {
      try {
        this.db.run('BEGIN TRANSACTION;');
        for (const pt of points) {
          this.db.run(
            `INSERT OR REPLACE INTO yield_curves (curve_id, tenor, rate) VALUES (?, ?, ?);`,
            [pt.curveId, pt.tenor, pt.rate]
          );
        }
        this.db.run('COMMIT;');
        this.persist();
        return;
      } catch (e) {
        this.db.run('ROLLBACK;');
        console.warn('SQLite saveYieldCurves error, using fallback:', e);
      }
    }

    for (const pt of points) {
      const idx = this.fallbackStore.yieldCurves.findIndex((x) => x.curveId === pt.curveId && x.tenor === pt.tenor);
      if (idx >= 0) {
        this.fallbackStore.yieldCurves[idx] = pt;
      } else {
        this.fallbackStore.yieldCurves.push(pt);
      }
    }
    this.persistFallback();
  }

  public getYieldCurves(): YieldCurvePoint[] {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec('SELECT curve_id, tenor, rate FROM yield_curves ORDER BY curve_id, tenor;');
        if (res.length && res[0].values.length) {
          return res[0].values.map((row) => ({
            curveId: row[0] as YieldCurvePoint['curveId'],
            tenor: row[1] as YieldCurvePoint['tenor'],
            rate: row[2] as number,
          }));
        }
      } catch (e) {
        console.warn('SQLite getYieldCurves error, using fallback:', e);
      }
    }

    return [...this.fallbackStore.yieldCurves];
  }

  /**
   * 5. State Reconstruction:
   * Dynamically computes the portfolio holdings, cost basis, and cash balances
   * for any target date (T_n) by taking the T_0 Snapshot and rolling forward
   * all ledgered transactions strictly up to T_n.
   */
  public rollPortfolioState(targetDateStr: string): RolledPortfolioState {
    const snapshot = this.getInceptionSnapshot();
    if (!snapshot) {
      return {
        targetDate: targetDateStr,
        snapshotDate: targetDateStr,
        positions: [],
        cashBalances: { USD: 0 },
        transactionsApplied: 0,
      };
    }

    const t0Date = snapshot.snapshotDate;

    // Track holdings state by ISIN
    const posMap = new Map<string, RolledPositionState>();

    for (const snapPos of snapshot.positions) {
      const costBasis = (snapPos.bookPrice / 100) * snapPos.quantity;
      posMap.set(snapPos.isin, {
        isin: snapPos.isin,
        quantity: snapPos.quantity,
        costBasis,
        costPrice: snapPos.bookPrice,
        currency: snapPos.currency,
        firstAcquiredDate: snapPos.acquisitionDate || t0Date,
      });
    }

    // Initialize cash from snapshot across all local currencies (USD, EUR, GBP, CHF, JPY, CAD, AUD, etc.)
    const cash: Record<string, number> = {
      ...snapshot.cashBalances,
    };

    // Get all transactions where trade_date > t0Date AND trade_date <= targetDateStr
    // Sorted chronologically
    const allTx = this.getTransactions();
    const applicableTx = allTx
      .filter((tx) => tx.tradeDate > t0Date && tx.tradeDate <= targetDateStr)
      .sort((a, b) => {
        if (a.tradeDate !== b.tradeDate) return a.tradeDate.localeCompare(b.tradeDate);
        return a.settlementDate.localeCompare(b.settlementDate);
      });

    for (const tx of applicableTx) {
      const existing = posMap.get(tx.isin);

      switch (tx.type) {
        case 'BUY': {
          if (existing) {
            const newQty = existing.quantity + tx.quantity;
            const newCost = existing.costBasis + tx.netAmount;
            existing.quantity = newQty;
            existing.costBasis = newCost;
            existing.costPrice = newQty > 0 ? (newCost / newQty) * 100 : tx.price;
          } else {
            posMap.set(tx.isin, {
              isin: tx.isin,
              quantity: tx.quantity,
              costBasis: tx.netAmount,
              costPrice: tx.price,
              currency: tx.currency,
              firstAcquiredDate: tx.tradeDate,
            });
          }
          // Cash outflow
          cash[tx.currency] = (cash[tx.currency] || 0) - tx.netAmount;
          break;
        }

        case 'SELL': {
          if (existing) {
            const soldRatio = existing.quantity > 0 ? tx.quantity / existing.quantity : 1;
            existing.costBasis = Math.max(0, existing.costBasis - existing.costBasis * soldRatio);
            existing.quantity = Math.max(0, existing.quantity - tx.quantity);
          }
          // Cash inflow
          cash[tx.currency] = (cash[tx.currency] || 0) + tx.netAmount;
          break;
        }

        case 'REDEMPTION': {
          if (existing) {
            const redeemedRatio = existing.quantity > 0 ? tx.quantity / existing.quantity : 1;
            existing.costBasis = Math.max(0, existing.costBasis - existing.costBasis * redeemedRatio);
            existing.quantity = Math.max(0, existing.quantity - tx.quantity);
          }
          // Cash inflow
          cash[tx.currency] = (cash[tx.currency] || 0) + tx.netAmount;
          break;
        }

        case 'COUPON': {
          // Cash inflow (coupon dividend)
          cash[tx.currency] = (cash[tx.currency] || 0) + tx.netAmount;
          break;
        }

        case 'FEE': {
          // Cash outflow
          cash[tx.currency] = (cash[tx.currency] || 0) - tx.netAmount;
          break;
        }
      }
    }

    const positions = Array.from(posMap.values()).filter((p) => p.quantity > 0.0001);

    return {
      targetDate: targetDateStr,
      snapshotDate: t0Date,
      positions,
      cashBalances: cash,
      transactionsApplied: applicableTx.length,
    };
  }

  /**
   * 6. Transaction Validation:
   * Prevents selling or redeeming more than the available holding on trade date
   */
  public validateTradeSize(
    isin: string,
    tradeDate: string,
    type: 'SELL' | 'REDEMPTION',
    quantity: number
  ): { isValid: boolean; availableQuantity: number; errorMessage?: string } {
    const rolled = this.rollPortfolioState(tradeDate);
    const pos = rolled.positions.find((p) => p.isin === isin);
    const available = pos ? pos.quantity : 0;

    if (quantity > available) {
      return {
        isValid: false,
        availableQuantity: available,
        errorMessage: `Validation Error: Attempting to ${type.toLowerCase()} ${quantity.toLocaleString()} par, but only ${available.toLocaleString()} par is held as of trade date ${tradeDate}.`,
      };
    }

    return {
      isValid: true,
      availableQuantity: available,
    };
  }

  /**
   * 7. Arbitrary SQL Query Runner
   */
  public executeCustomSql(query: string): { columns: string[]; rows: any[][]; error?: string } {
    if (this.db && this.isWasmActive) {
      try {
        const res = this.db.exec(query);
        if (!res.length) {
          return { columns: ['Status'], rows: [['Query executed successfully. 0 rows returned.']] };
        }
        return {
          columns: res[0].columns,
          rows: res[0].values,
        };
      } catch (err: any) {
        return {
          columns: ['Error'],
          rows: [[err.message || String(err)]],
          error: err.message || String(err),
        };
      }
    }

    // Emulated SQL for query inspector in fallback mode
    const cleanQ = query.trim().toUpperCase();
    if (cleanQ.includes('TRANSACTIONS')) {
      const txs = this.getTransactions();
      return {
        columns: ['id', 'trade_date', 'isin', 'type', 'quantity', 'price', 'gross_amount', 'currency'],
        rows: txs.map((t) => [t.id, t.tradeDate, t.isin, t.type, t.quantity, t.price, t.grossAmount, t.currency]),
      };
    } else if (cleanQ.includes('SNAPSHOT_POSITIONS')) {
      const snap = this.getInceptionSnapshot();
      return {
        columns: ['isin', 'quantity', 'book_price', 'accrued_interest_t0', 'currency'],
        rows: (snap?.positions || []).map((p) => [p.isin, p.quantity, p.bookPrice, p.accruedInterestT0, p.currency]),
      };
    } else if (cleanQ.includes('INSTRUMENTS')) {
      const insts = this.getInstruments();
      return {
        columns: ['isin', 'name', 'issuer', 'currency', 'asset_class', 'credit_rating', 'sector'],
        rows: insts.map((i) => [i.isin, i.name, i.issuer, i.currency, i.assetClass, i.creditRating, i.sector]),
      };
    } else if (cleanQ.includes('MARKET_PRICES')) {
      const prices = this.getMarketPrices();
      return {
        columns: ['isin', 'clean_price', 'bid', 'ask', 'source', 'as_of_date'],
        rows: prices.map((p) => [p.isin, p.cleanPrice, p.bid || null, p.ask || null, p.source, p.asOfDate]),
      };
    }

    return {
      columns: ['Notice'],
      rows: [['Query executed on local database tables.']],
    };
  }

  public exportSqliteBinary(): Uint8Array | null {
    if (this.db && this.isWasmActive) {
      try {
        return this.db.export();
      } catch (e) {
        console.warn('SQLite export failed, generating JSON dump:', e);
      }
    }

    // Fallback dump
    const dump = JSON.stringify({
      snapshot: this.getInceptionSnapshot(),
      instruments: this.getInstruments(),
      transactions: this.getTransactions(),
      marketPrices: this.getMarketPrices(),
      fxRates: this.getFxRates(),
      yieldCurves: this.getYieldCurves(),
    }, null, 2);
    return new TextEncoder().encode(dump);
  }

  public resetAllData(): void {
    localStorage.removeItem(DB_STORAGE_KEY);
    localStorage.removeItem(FALLBACK_STORAGE_KEY);
    this.fallbackStore = {
      instruments: [],
      snapshot: null,
      transactions: [],
      marketPrices: [],
      fxRates: [],
      yieldCurves: [],
    };

    if (this.db && this.isWasmActive) {
      try {
        this.db.run(`
          DROP TABLE IF EXISTS instruments;
          DROP TABLE IF EXISTS snapshot_metadata;
          DROP TABLE IF EXISTS snapshot_positions;
          DROP TABLE IF EXISTS snapshot_cash;
          DROP TABLE IF EXISTS transactions;
          DROP TABLE IF EXISTS market_prices;
          DROP TABLE IF EXISTS fx_rates;
          DROP TABLE IF EXISTS yield_curves;
        `);
        this.ensureSchema();
        this.persist();
      } catch (e) {
        console.warn('Reset error in SQLite:', e);
      }
    }
  }
}

export const sqliteService = new SqlitePortfolioService();
