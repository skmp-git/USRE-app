/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StandardCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CHF'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'SEK'
  | 'NOK'
  | 'SGD';

export type Currency = StandardCurrency | (string & {});

export type AssetClass =
  | 'DirectBond'
  | 'MutualFund'
  | 'CapFloorFloater'
  | 'BondLinkedNote'
  | 'PrivatePlacement';

export type DayCountConvention =
  | '30/360'
  | 'Act/Act'
  | 'Act/360'
  | 'Act/365';

export type CouponFrequency = 1 | 2 | 4 | 12; // Annual, Semi-Annual, Quarterly, Monthly

export type TransactionType =
  | 'BUY'
  | 'SELL'
  | 'COUPON'
  | 'REDEMPTION'
  | 'FEE';

export type DividendPolicy = 'Distributing' | 'Accumulating';

export type CreditRating =
  | 'AAA'
  | 'AA+'
  | 'AA'
  | 'AA-'
  | 'A+'
  | 'A'
  | 'A-'
  | 'BBB+'
  | 'BBB'
  | 'BBB-'
  | 'BB+'
  | 'BB'
  | 'B'
  | 'CCC'
  | 'NR';

export type Sector =
  | 'Sovereign / Treasury'
  | 'Financials'
  | 'Corporate / Industrial'
  | 'Technology'
  | 'Utilities / Infrastructure'
  | 'Securitized / Covered'
  | 'Emerging Markets';

export type PaymentRank =
  | 'Sovereign / Super Senior'
  | 'Senior Secured'
  | 'Senior Unsecured'
  | 'Subordinated / Tier 2'
  | 'Junior / Structured Note'
  | 'Fund / Equity Tranche';

// Base Instrument Interface
export interface BaseInstrument {
  isin: string;
  name: string;
  issuer: string;
  currency: Currency;
  assetClass: AssetClass;
  creditRating: CreditRating;
  sector: Sector;
  paymentRank?: PaymentRank;
  description?: string;
}

// 1. Direct Bonds
export interface DirectBond extends BaseInstrument {
  assetClass: 'DirectBond';
  maturityDate: string; // YYYY-MM-DD
  couponRate: number; // e.g., 0.045 for 4.5%
  couponFrequency: CouponFrequency;
  dayCount: DayCountConvention;
  firstCouponDate?: string;
  isAmortizing?: boolean;
  amortizationFactor?: number; // 1.0 down to 0
  callable?: boolean;
  callPrice?: number;
  callDate?: string;
  issueDate?: string;
}

// 2. Fixed Income Mutual Funds
export interface MutualFund extends BaseInstrument {
  assetClass: 'MutualFund';
  ticker: string;
  fundManager: string;
  dividendPolicy: DividendPolicy;
  expenseRatio?: number;
  effectiveDuration?: number; // Reported duration in years
  dividendYield?: number;
}

// 3. Structured Notes: Cap-Floor Floaters
export interface CapFloorFloater extends BaseInstrument {
  assetClass: 'CapFloorFloater';
  maturityDate: string;
  referenceRate: 'SOFR' | 'EURIBOR_3M' | 'EURIBOR_6M' | 'SONIA';
  marginBps: number; // spread in bps, e.g. 125 for 1.25%
  capLevel: number; // e.g. 0.055 for 5.50%
  floorLevel: number; // e.g. 0.020 for 2.00%
  resetFrequency: CouponFrequency;
  lastResetDate: string;
  nextResetDate: string;
  currentCouponRate: number;
  dayCount: DayCountConvention;
}

// 4. Structured Notes: Bond-Linked Notes (Short Put)
export interface BondLinkedNote extends BaseInstrument {
  assetClass: 'BondLinkedNote';
  underlyingBondIsin: string;
  underlyingBondName: string;
  strikePricePct: number; // e.g. 100.0 or 95.0
  barrierLevelPct?: number; // e.g. 80.0
  expiryDate: string;
  guaranteedCouponRate: number; // Annualized
  optionPremiumReceived?: number;
  dayCount: DayCountConvention;
}

// 5. Structured Notes: Private Placement Notes (Fixed & Floater)
export interface PrivatePlacementNote extends BaseInstrument {
  assetClass: 'PrivatePlacement';
  maturityDate: string;
  isFloater: boolean;
  referenceRate?: string;
  marginBps?: number;
  fixedCouponRate?: number;
  couponFrequency: CouponFrequency;
  dayCount: DayCountConvention;
  illiquidValuationFlag: boolean; // Model-priced / Matrix / Illiquid
  counterpartyGuarantor?: string;
  jurisdiction: string;
  seniority: 'Senior Secured' | 'Senior Unsecured' | 'Subordinated';
  customScheduleNotes?: string;
}

export type Instrument =
  | DirectBond
  | MutualFund
  | CapFloorFloater
  | BondLinkedNote
  | PrivatePlacementNote;

// Inception Snapshot as of T_0
export interface SnapshotPosition {
  isin: string;
  quantity: number; // Par value for bonds, shares for funds
  bookPrice: number; // Clean price (%) for bonds, unit price for funds
  accruedInterestT0: number; // Accrued interest per 100 par at T_0
  currency: Currency;
  acquisitionDate: string;
}

export interface InceptionSnapshot {
  snapshotDate: string; // T_0 (e.g. "2025-12-31")
  portfolioName: string;
  positions: SnapshotPosition[];
  cashBalances: Record<string, number>; // Cash by currency as of T_0
  notes?: string;
}

// Transaction Ledgering (strictly after T_0)
export interface Transaction {
  id: string;
  tradeDate: string; // YYYY-MM-DD
  settlementDate: string; // YYYY-MM-DD
  isin: string;
  type: TransactionType;
  quantity: number; // Par or units traded
  price: number; // Clean price (%) or unit NAV
  accruedInterestPct?: number; // % of par
  grossAmount: number; // Quantity * Price
  netAmount: number; // Gross +/- Accrued +/- Fees
  currency: Currency;
  counterparty?: string;
  fee?: number;
  notes?: string;
}

// Market Data
export interface MarketPrice {
  isin: string;
  cleanPrice: number; // % for bonds/notes, unit NAV for funds
  bid?: number;
  ask?: number;
  yieldToMaturity?: number;
  source: 'Bloomberg' | 'Tradeweb' | 'Manual' | 'Model' | 'FundAdmin';
  asOfDate: string;
}

export interface FxRate {
  pair: string; // e.g. "EUR/USD", "GBP/USD", "USD/CHF"
  rate: number; // Units of quote currency per 1 base unit
  asOfDate: string;
}

export interface YieldCurvePoint {
  curveId: 'SOFR' | 'UST' | 'EURIBOR';
  tenor: '1M' | '3M' | '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '7Y' | '10Y' | '20Y' | '30Y';
  rate: number; // Decimal, e.g. 0.0435 for 4.35%
}

// Calculations & Risk Results
export interface PositionValuation {
  isin: string;
  instrument: Instrument;
  quantity: number; // Current rolled quantity as of T_n
  costBasis: number; // Total book cost
  costPrice: number; // Average book price
  cleanPrice: number;
  accruedInterestPct: number;
  dirtyPrice: number;
  marketValueLocal: number; // Dirty MV in instrument currency
  fxToBase: number; // Multiplier to convert local CCY to Base CCY
  marketValueBase: number; // Dirty MV in selected Base Currency
  portfolioWeight: number; // % of total portfolio value
  unrealizedPnLBase: number; // MV Base - Cost Basis Base
  costPnLPct: number; // (unrealizedPnLBase / costBasis) * 100
  ytdReturnPct: number; // Year-to-Date total return %
  mtdReturnPct: number; // Month-to-Date total return %
  ytm: number; // Yield to maturity (annualized decimal)
  ytw?: number; // Yield to worst (if callable)
  macaulayDuration: number; // In years
  modifiedDuration: number; // In years
  convexity: number;
  dv01Local: number; // Local dollar value of 1bp shift
  dv01Base: number; // Base currency dollar value of 1bp shift
  nextCouponDate?: string;
  nextCouponAmount?: number;
  isMatured: boolean;
  pricingMissing: boolean;
  illiquidFlag?: boolean;
}

export interface RiskAggregation {
  category: string;
  marketValue: number;
  portfolioWeight: number;
  weightedDuration: number;
  weightedYtm: number;
  dv01: number;
}

export interface FloatingRateResetEvent {
  isin: string;
  instrumentName: string;
  referenceRate: string;
  marginBps: number;
  capLevel: number;
  floorLevel: number;
  currentFixing: number;
  currentCouponRate: number;
  nextResetDate: string;
  daysToReset: number;
  estimatedNextCoupon: number;
  currency: Currency;
  notional: number;
}

export interface KeyRateDurationPoint {
  tenor: '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '7Y' | '10Y' | '20Y' | '30Y';
  years: number;
  duration: number; // Portfolio KRD in years
  dv01: number; // Dollar value of 1bp shift in this key rate tenor
  percentage: number; // % of total portfolio duration
}

export interface CouponBinDistribution {
  binLabel: string;
  minCoupon: number;
  maxCoupon: number;
  marketValue: number;
  portfolioWeight: number;
  holdingsCount: number;
  weightedDuration: number;
  weightedCoupon: number;
}

export interface PeriodReturn {
  period: 'YTD' | 'QTD' | 'MTD';
  label: string;
  startDate: string;
  endDate: string;
  totalReturnPct: number; // in percentage, e.g. +4.85%
  priceReturnPct: number; // in percentage, e.g. +1.42%
  couponReturnPct: number; // in percentage, e.g. +3.43%
  totalReturnDollar: number;
  priceReturnDollar: number;
  couponReturnDollar: number;
}

export interface SecurityPeriodReturn {
  isin: string;
  name: string;
  currency: Currency;
  assetClass: AssetClass;
  totalReturnPct: number;
  priceReturnPct: number;
  couponReturnPct: number;
  marketValueBase: number;
  portfolioWeightPct: number; // % of holdings
  contributedReturnPct: number; // weight * totalReturnPct in %
  contributedReturnBps: number; // in basis points (bps)
  contributedPricePct: number;
  contributedCouponPct: number;
  dollarContributionBase: number;
}

export interface AssetClassReturnContribution {
  assetClass: AssetClass;
  label: string; // "Direct Bond", "Mutual Fund", "CapFloor Floater", "BondLinkedNote", "PrivatePlacement"
  marketValueBase: number;
  portfolioWeightPct: number;
  positionsCount: number;
  averageReturnPct: number;
  contributedReturnPct: number; // Sum of position contributions in %
  contributedReturnBps: number; // in basis points (bps)
  contributedCouponPct: number;
  contributedPricePct: number;
  dollarContributionBase: number;
  topStrengths: SecurityPeriodReturn[];
  topWeaknesses: SecurityPeriodReturn[];
  positions: SecurityPeriodReturn[];
}

export interface PortfolioValuationResult {
  asOfDate: string; // T_n
  snapshotDate: string; // T_0
  baseCurrency: Currency;
  totalPortfolioValue: number; // Holdings MV + Cash in Base CCY
  totalHoldingsValue: number;
  totalCashValue: number;
  cashBalances: Record<string, number>;
  unrealizedPnL: number;
  weightedYtm: number;
  weightedDuration: number;
  weightedMacaulayDuration: number;
  weightedConvexity: number;
  weightedCoupon: number;
  totalDv01: number;
  positions: PositionValuation[];
  returns: {
    ytd: PeriodReturn;
    qtd: PeriodReturn;
    mtd: PeriodReturn;
    securityReturns: SecurityPeriodReturn[];
    assetClassContributions: AssetClassReturnContribution[];
  };
  keyRateDurations: KeyRateDurationPoint[];
  couponDistributions: CouponBinDistribution[];
  paymentRankDistributions: RiskAggregation[];
  breakdowns: {
    bySector: RiskAggregation[];
    byRating: RiskAggregation[];
    byCounterparty: RiskAggregation[];
    byCurrency: RiskAggregation[];
    byAssetClass: RiskAggregation[];
    byPaymentRank: RiskAggregation[];
  };
  floatingResets: FloatingRateResetEvent[];
  warnings: string[];
}
