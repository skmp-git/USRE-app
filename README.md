# Fixed Income Portfolio Management Workstation — Data Input & User Guide

Welcome to the **Fixed Income Desktop Portfolio Management Workstation**. This document explains the quantitative principles, database schema, and step-by-step instructions for inputting portfolio data, recording transactions, configuring market feeds, and interpreting yield curve structures and performance analytics.

## Quick Start: Running from Desktop (.BAT Launcher)

You can launch the workstation on Windows using either method below:

### Option A: One-Click Standalone Runner (No Node.js Required)
1. Double-click **`launch_without_node.bat`**.
2. Uses Windows' built-in .NET/PowerShell web engine to serve the workstation on `http://127.0.0.1:3000`.
3. Opens Microsoft Edge or Google Chrome immediately. Requires **zero software installation**.

### Option B: Node.js Development Server
1. Double-click **`run_desktop.bat`** (or **`start_app.bat`**).
2. The batch script automatically:
   - Enforces a **persistent console window (`cmd /k`)** that **never vanishes or closes** on error.
   - Detects Node.js across common Windows install paths (`C:\Program Files\nodejs`, LocalAppData, NVM, etc.).
   - If Node.js is missing, offers to run the Standalone server or open the official Node download page.
   - Installs dependencies (`npm install`) on first launch if required.
   - Starts Vite and automatically opens your browser once the server is ready.

### Troubleshooting:
- **If you extracted from a ZIP**: Make sure all files are extracted to a standard folder (e.g. `Desktop` or `Documents`) rather than opening directly from inside a `.zip` archive.
- **Diagnostic Mode**: Double-click **`debug_run.bat`** to run a complete diagnostic scan with permanent console logs.
- *(macOS / Linux users)*: Execute `./run_desktop.sh` in your terminal.

---

## Table of Contents
0. [Quick Start: Desktop Launchers (.BAT)](#quick-start-running-from-desktop-bat-launcher)
1. [Architecture Overview & Roll-Forward Engine](#1-architecture-overview--roll-forward-engine)
2. [Data Input Workflows](#2-data-input-workflows)
   - [A. Initial Inception Snapshot ($T_0$)](#a-initial-inception-snapshot-t_0)
   - [B. Transaction Ledger (Post-$T_0$)](#b-transaction-ledger-post-t_0)
   - [C. Market Clean Prices ($T_n$)](#c-market-clean-prices-t_n)
   - [D. Foreign Exchange (FX) Rates](#d-foreign-exchange-fx-rates)
   - [E. Benchmark Yield Curves & Tenors](#e-benchmark-yield-curves--tenors)
   - [F. Instrument Specifications](#f-instrument-specifications)
3. [Format & Unit Standards Reference Table](#3-format--unit-standards-reference-table)
4. [Quantitative Formulas & Attribution](#4-quantitative-formulas--attribution)
5. [Database Management & SQLite Exports](#5-database-management--sqlite-exports)

---

## 1. Architecture Overview & Roll-Forward Engine

The workstation uses a **$T_0$ Inception Snapshot + Transaction Ledger** model:

$$\text{Holdings}(T_n) = \text{Snapshot}(T_0) + \sum_{t = T_0^+}^{T_n} \text{Transactions}(t)$$

- **Never hardcode historical states**: You set the inception portfolio at $T_0$, record chronological trades (`BUY`, `SELL`, `COUPON`, `REDEMPTION`), and set the target valuation date $T_n$.
- **Automated Reconstruction**: The engine dynamically rolls forward quantities, cost basis (via weighted-average accounting), and cash balances from $T_0$ to any $T_n$.
- **Local Persistence**: State is stored in an embedded SQLite database (with automatic localStorage backup) and can be exported as a standard SQLite binary file at any time.

---

## 2. Data Input Workflows

### A. Initial Inception Snapshot ($T_0$)
**Location in App**: Navigation Bar $\rightarrow$ **Transactions & Snapshot** $\rightarrow$ **$T_0$ Inception Snapshot Configuration**

Use this view to define the portfolio as of inception (e.g. December 31, 2025):

1. **Snapshot Date**: Enter ISO date format `YYYY-MM-DD` (e.g., `2025-12-31`).
2. **Initial Cash Balances**: Enter starting cash held in each supported currency:
   - `USD`, `EUR`, `GBP`, `CHF`.
3. **Inception Position Records**: For each position held at $T_0$, specify:
   - **ISIN**: 12-character alphanumeric standard identifier (e.g., `US91282CDP39`).
   - **Quantity (Par / Face Value)**:
     - For bonds: Face value in currency units (e.g., `1000000` for \$1,000,000 par).
     - For funds: Number of shares (e.g., `85000`).
   - **Book Clean Price**: Acquisition price per 100 par (e.g., `99.50` or `101.25`).
   - **Accrued Interest $AI(T_0)$**: Accrued coupon interest per 100 par on inception date (e.g., `0.750` for 0.75% accrued).
   - **Currency**: `USD`, `EUR`, `GBP`, or `CHF`.
   - **Acquisition Date**: Inception acquisition date (`YYYY-MM-DD`).

---

### B. Transaction Ledger (Post-$T_0$)
**Location in App**: Navigation Bar $\rightarrow$ **Transactions & Snapshot** $\rightarrow$ **Post-$T_0$ Transaction Ledger** $\rightarrow$ Click **+ Log Transaction**

Record all activity occurring strictly after $T_0$:

| Transaction Type | Quantity Effect | Cost Basis Effect | Cash Effect | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **BUY** | $+\text{Quantity}$ | New WAC Basis: $\frac{\text{Old Cost} + \text{Net Outflow}}{\text{New Qty}} \times 100$ | Cash Outflow: $-\text{Net Amount}$ | Cannot buy unlisted ISINs |
| **SELL** | $-\text{Quantity}$ | Proportionally reduced: $\text{Old Cost} \times \left(1 - \frac{Qty_{sold}}{Qty_{old}}\right)$ | Cash Inflow: $+\text{Net Amount}$ | Pre-trade validation rejects short selling |
| **COUPON** | Unchanged | Unchanged | Cash Inflow: $+\text{Gross} - \text{Fees}$ | Cash interest distribution receipt |
| **REDEMPTION** | $-\text{Quantity}$ | Proportionally reduced | Cash Inflow: $+\text{Net Amount}$ | Contractual principal repayment / sinking fund |

**Fields Required When Logging a Trade**:
- **ISIN**: Selected from instrument catalog.
- **Trade Date**: Must be $\ge T_0$ (`YYYY-MM-DD`).
- **Settlement Date**: Must be $\ge \text{Trade Date}$.
- **Quantity**: Positive integer (par face value or share count).
- **Execution Price**: Clean price per 100 par (e.g., `100.50`).
- **Accrued Interest %**: Percentage accrued traded with the bond (e.g., `0.45` for 0.45%).
- **Fee / Commission**: Transaction brokerage fee (deducted from net settlement).
- **Counterparty & Notes**: Trading desk, clearing broker (e.g., Tradeweb, Euroclear).

#### Multi-File Batch CSV Ingestion & Downloadable Templates
To save time logging positions one by one, switch to **Batch CSV Ingestion & Templates** within the Transaction Ledger:
1. **Multi-File Drag & Drop**: Select or drag a list of multiple CSV files simultaneously (e.g., separate files for trade executions, quarterly coupons, and principal redemptions).
2. **Ingestion Modes**:
   - **Append to Ledger**: Adds parsed transactions to the existing database without modifying previous trades.
   - **Replace Entire Ledger**: Wipes post-$T_0$ transactions and replaces them entirely with the staged dataset (ideal for bulk periodic reconciliations).
3. **Smart Schema Mapping & Auto-Calculations**:
   - If `Net_Amount` is omitted, the engine automatically calculates it from `Quantity`, `Price`, `Accrued_Interest_Pct`, and `Fee`.
   - If `Currency` is omitted, the engine looks up the instrument's currency from your active catalog.
   - If `Settlement_Date` is omitted, defaults to `Trade_Date`.
4. **Downloadable Standard Templates**:
   - **`transactions_ledger_template.csv`**: Full ledger template with sample BUY, SELL, COUPON, REDEMPTION, and FEE rows.
   - **`trades_buy_sell_blotter_template.csv`**: Execution trade blotter format.
   - **`cashflows_coupons_redemptions_template.csv`**: Cash distribution and principal maturity format.
   - **`active_instruments_catalog_transactions.csv`**: Pre-populated template using the active ISINs and local currencies in your portfolio.

---

### C. Market Clean Prices ($T_n$)
**Location in App**: Navigation Bar $\rightarrow$ **Market Data & Prices** $\rightarrow$ **Clean Prices Table**

Enter the observable clean market quotes for each security as of the active valuation date $T_n$:
- **Clean Price**: Quoted per 100 par (e.g., `99.85`). Dirty price is automatically calculated:
  $$\text{Dirty Price} = \text{Clean Price} + \text{Accrued Interest}(T_n)$$
- **Bid / Ask**: Optional bid and ask spreads (e.g., `99.82` / `99.88`).
- **Source**: Bloomberg, Tradeweb, Model, FundAdmin.
- **As of Date**: ISO date matching valuation date.

---

### D. Foreign Exchange (FX) Rates & Multi-Currency Engine
**Location in App**: Navigation Bar $\rightarrow$ **Market Data & Prices** $\rightarrow$ **Foreign Exchange (FX) Rates**

The workstation provides full native support for portfolios containing positions in various local currencies (`USD`, `EUR`, `GBP`, `CHF`, `JPY`, `CAD`, `AUD`, `SEK`, `NOK`, `SGD`):

1. **Local Valuation**:
   $$\text{Market Value}_{\text{local}} = \frac{\text{Dirty Price}_{\text{local}}}{100} \times \text{Quantity}_{\text{par}}$$
   Positions are priced in their native currency according to local market quotes and day-count conventions.

2. **Base Currency Translation**:
   $$\text{Market Value}_{\text{base}} = \text{Market Value}_{\text{local}} \times \text{FX}(\text{CCY}_{\text{local}} \rightarrow \text{CCY}_{\text{base}})$$
   $$\text{DV01}_{\text{base}} = \text{Market Value}_{\text{base}} \times \text{Modified Duration} \times 0.0001$$

3. **Multi-Currency Cash Ledgering**:
   - Cash balances are maintained strictly segregated by currency (e.g. `USD`, `EUR`, `JPY`, `CAD`, `AUD`).
   - Transactions execute in the instrument's denomination currency: buying a Japanese Government Bond debits JPY cash, while collecting coupons on a UK Gilt credits GBP cash.
   - Total portfolio cash balance is aggregated dynamically into the active Base Currency using live spot triangulation.

4. **FX Triangulation & Cross Rates**:
   - Direct quote support (e.g., `EUR/USD = 1.0835`, `GBP/USD = 1.2865`).
   - Automatic reciprocal inverse calculation (e.g., `USD/JPY = 152.45` $\implies$ `JPY/USD = 0.00656`).
   - Cross-currency triangulation via USD pivot:
     $$\text{FX}(\text{From} \rightarrow \text{To}) = \text{FX}(\text{From} \rightarrow \text{USD}) \times \text{FX}(\text{USD} \rightarrow \text{To})$$

5. **Dynamic Base Currency Switching**:
   - Select any supported currency (`USD`, `EUR`, `GBP`, `CHF`, `JPY`, `CAD`, `AUD`) in the top navigation bar.
   - The entire portfolio immediately translates market values, cost bases, unrealized P&L, DV01, and returns into the chosen base currency.

---

### E. Benchmark Yield Curves & Tenors
**Location in App**: Navigation Bar $\rightarrow$ **Market Data & Prices** $\rightarrow$ **Benchmark Yield Curves**

Input spot/par yields across the term structure:
- **Supported Curves**:
  - `UST`: US Treasury Benchmark Par Yield Curve.
  - `SOFR`: USD Secured Overnight Financing Rate swap curve.
  - `EURIBOR`: Euro Interbank Offered Rate / Bund curve.
- **Standard Tenors**:
  `1M`, `3M`, `6M`, `1Y`, `2Y`, `3Y`, `5Y`, `7Y`, `10Y`, `20Y`, `30Y`.
- **Input Value**: Rate entered as a decimal (e.g., `0.0428` for 4.28%) or percentage (`4.28%`).

---

### F. Instrument Specifications
The workstation supports multiple asset classes with tailored pricing engines:

1. **Direct Fixed-Rate Bonds**:
   - `couponRate`: Annualized decimal (e.g., `0.045` for 4.50%).
   - `couponFrequency`: `Annual`, `Semi-Annual`, `Quarterly`, `Monthly`.
   - `dayCountConvention`: `ACT/ACT_ICMA`, `ACT/360`, `30/360_US`.
   - `maturityDate`: `YYYY-MM-DD`.
   - `seniority`: `Senior Secured`, `Senior Unsecured`, `Subordinated / Tier 2`, `Additional Tier 1 / Hybrid`, `Sovereign / Super Senior`.

2. **Cap/Floor Floating Rate Notes (FRNs)**:
   - `referenceRate`: `SOFR`, `EURIBOR`, `SONIA`.
   - `marginBps`: Spread in basis points (e.g., `120` for +1.20%).
   - `capLevel`: Maximum coupon ceiling (e.g., `0.065` for 6.50%).
   - `floorLevel`: Minimum coupon floor (e.g., `0.020` for 2.00%).
   - `resetFrequency`: `Quarterly`, `Semi-Annual`.

3. **Structured Notes (Bond-Linked Notes)**:
   - `protectionFloor`: Principal guarantee (e.g., `0.90` for 90% floor).
   - `participationRate`: Upside participation (e.g., `0.80` for 80%).
   - `underlyingAsset`: S&P 500, EURO STOXX 50, etc.
   - `strikePrice` & `currentUnderlyingPrice`.

4. **Private Placement Notes**:
   - `illiquiditySpreadBps`: Spread premium reflecting lack of secondary liquidity (e.g., `175 bps`).
   - `sinkingFundSchedule`: Sinking fund amortizing schedule.

---

## 3. Format & Unit Standards Reference Table

| Metric / Field | Input Format | Internal Representation | Example |
| :--- | :--- | :--- | :--- |
| **Date** | ISO 8601 String | `YYYY-MM-DD` | `2026-11-02` |
| **Bond Clean Price** | Points per 100 par | Number | `101.25` |
| **Accrued Interest** | Points per 100 par | Number | `0.852` |
| **Coupon Rate** | Decimal or % | Decimal | `0.0450` ($4.50\%$) |
| **Spread** | Basis Points (bps) | Integer / Number | `+142 bps` |
| **Quantity (Par)** | Face Value Currency | Number | `1,000,000` |
| **Fund Shares** | Share Units | Number | `85,000` |
| **Credit Rating** | S&P/Moody's Standard | String | `AAA`, `AA+`, `A-`, `BBB`, `BB+`, `B`, `NR` |

---

## 4. Quantitative Formulas & Attribution

### Return Additivity Decomposition
Total return from $T_{start}$ to $T_n$ is decomposed additively into capital gains and income:

$$R_{total} = R_{price} + R_{coupon}$$

- **Price Return ($R_{price}$)**:
  $$R_{price} = \frac{P_{clean}(T_n) - P_{clean}(T_{start})}{P_{dirty}(T_{start})}$$

- **Coupon Return ($R_{coupon}$)**:
  $$R_{coupon} = \frac{[AI(T_n) - AI(T_{start})] + C}{P_{dirty}(T_{start})}$$
  *(where $C$ is total cash coupons received per 100 par during the holding window).*

### Key Rate Durations (KRD)
Non-parallel curve sensitivities are distributed across 9 benchmark tenors:

$$\Delta P \approx -\sum_{i=1}^9 \text{DV01}_i \times \Delta y_{i, \text{bps}}$$

---

## 5. Database Management & SQLite Exports

- **Database Inspector**: Navigate to **SQLite Console & Query** in the top navigation bar to execute custom SQL queries against the local database schema (`SELECT * FROM transactions`, etc.).
- **Exporting Backup**: Click **Export SQLite Binary** in the header to download the complete local database file (`fixed_income_portfolio_YYYY-MM-DD.sqlite`).
- **Resetting Heritage State**: Click **Reset Demo Data** in the header at any time to restore the default baseline portfolio.
