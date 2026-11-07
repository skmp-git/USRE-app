/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Currency,
  DayCountConvention,
  CouponFrequency,
  DirectBond,
  CapFloorFloater,
  BondLinkedNote,
  PrivatePlacementNote,
  MutualFund,
  Instrument,
  MarketPrice,
  FxRate,
  PositionValuation,
  PortfolioValuationResult,
  RiskAggregation,
  FloatingRateResetEvent,
  InceptionSnapshot,
  Transaction,
  SnapshotPosition,
  PeriodReturn,
  SecurityPeriodReturn,
  AssetClassReturnContribution,
  AssetClass,
} from '../types/portfolio';

// Date utility functions
export function parseDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
}

export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addMonths(dateStr: string, months: number): string {
  const d = parseDate(dateStr);
  const currentMonth = d.getUTCMonth();
  d.setUTCMonth(currentMonth + months);
  return formatDate(d);
}

export function daysBetweenDates(d1: Date, d2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((d2.getTime() - d1.getTime()) / msPerDay);
}

/**
 * 1. Day Count Fraction Calculations
 */
export function calculateYearFraction(
  startDateStr: string,
  endDateStr: string,
  convention: DayCountConvention
): number {
  const d1 = parseDate(startDateStr);
  const d2 = parseDate(endDateStr);

  if (d2.getTime() <= d1.getTime()) return 0;

  switch (convention) {
    case '30/360': {
      // US Bond Basis (30/360)
      let d1Day = d1.getUTCDate();
      let d2Day = d2.getUTCDate();
      const m1 = d1.getUTCMonth() + 1;
      const m2 = d2.getUTCMonth() + 1;
      const y1 = d1.getUTCFullYear();
      const y2 = d2.getUTCFullYear();

      if (d1Day === 31) d1Day = 30;
      if (d2Day === 31 && d1Day === 30) d2Day = 30;

      const days = 360 * (y2 - y1) + 30 * (m2 - m1) + (d2Day - d1Day);
      return days / 360;
    }
    case 'Act/360': {
      const days = daysBetweenDates(d1, d2);
      return days / 360;
    }
    case 'Act/365': {
      const days = daysBetweenDates(d1, d2);
      return days / 365;
    }
    case 'Act/Act':
    default: {
      const days = daysBetweenDates(d1, d2);
      const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const avgDays = isLeapYear(d1.getUTCFullYear()) || isLeapYear(d2.getUTCFullYear()) ? 365.25 : 365;
      return days / avgDays;
    }
  }
}

/**
 * Find previous and next coupon payment dates around the settlement/valuation date
 */
export function getCouponDates(
  maturityDateStr: string,
  settlementDateStr: string,
  frequency: CouponFrequency
): { prevCouponDate: string; nextCouponDate: string; isPastMaturity: boolean } {
  const matDate = parseDate(maturityDateStr);
  const valDate = parseDate(settlementDateStr);

  if (valDate.getTime() >= matDate.getTime()) {
    return {
      prevCouponDate: maturityDateStr,
      nextCouponDate: maturityDateStr,
      isPastMaturity: true,
    };
  }

  const monthsPerPeriod = 12 / frequency;
  let curr = new Date(matDate.getTime());

  // Roll backward from maturity to find the surrounding coupon dates
  while (curr.getTime() > valDate.getTime()) {
    const prev = new Date(curr.getTime());
    prev.setUTCMonth(prev.getUTCMonth() - monthsPerPeriod);
    if (prev.getTime() <= valDate.getTime()) {
      return {
        prevCouponDate: formatDate(prev),
        nextCouponDate: formatDate(curr),
        isPastMaturity: false,
      };
    }
    curr = prev;
  }

  // Fallback
  return {
    prevCouponDate: settlementDateStr,
    nextCouponDate: maturityDateStr,
    isPastMaturity: false,
  };
}

/**
 * 2. Accrued Interest Calculator
 * Returns accrued interest as a percentage of par (e.g., 1.25 = $1.25 per $100 par)
 */
export function calculateAccruedInterest(
  couponRate: number, // e.g., 0.05 for 5%
  frequency: CouponFrequency,
  dayCount: DayCountConvention,
  settlementDateStr: string,
  prevCouponDateStr: string,
  nextCouponDateStr: string
): number {
  if (couponRate <= 0) return 0;

  const dSettlement = parseDate(settlementDateStr);
  const dPrev = parseDate(prevCouponDateStr);
  const dNext = parseDate(nextCouponDateStr);

  if (dSettlement <= dPrev) return 0;
  if (dSettlement >= dNext) return (couponRate / frequency) * 100;

  if (dayCount === 'Act/Act') {
    const daysAccrued = daysBetweenDates(dPrev, dSettlement);
    const daysInPeriod = Math.max(1, daysBetweenDates(dPrev, dNext));
    return (couponRate / frequency) * 100 * (daysAccrued / daysInPeriod);
  }

  // For 30/360, Act/360, Act/365
  const yearFraction = calculateYearFraction(prevCouponDateStr, settlementDateStr, dayCount);
  return couponRate * 100 * yearFraction;
}

/**
 * 3. Cash Flow Generator for Fixed Coupon Instruments
 */
export interface CashFlow {
  date: string;
  yearFraction: number; // Time from valuation date in years
  amount: number; // Coupon payment per 100 par
  principal: number; // Principal repayment per 100 par
  total: number;
}

export function generateCashFlows(
  maturityDateStr: string,
  settlementDateStr: string,
  couponRate: number,
  frequency: CouponFrequency,
  dayCount: DayCountConvention,
  amortizationFactor: number = 1.0
): CashFlow[] {
  const cashFlows: CashFlow[] = [];
  const valDate = parseDate(settlementDateStr);
  const matDate = parseDate(maturityDateStr);

  if (valDate.getTime() >= matDate.getTime()) {
    return cashFlows;
  }

  const monthsPerPeriod = 12 / frequency;
  const couponPerPeriod = (couponRate / frequency) * 100 * amortizationFactor;

  // Generate schedule forwards from the next coupon date to maturity
  const { nextCouponDate } = getCouponDates(maturityDateStr, settlementDateStr, frequency);
  let curr = parseDate(nextCouponDate);

  while (curr.getTime() <= matDate.getTime()) {
    const dateStr = formatDate(curr);
    const t = Math.max(0.001, calculateYearFraction(settlementDateStr, dateStr, dayCount));
    const isMaturity = curr.getTime() === matDate.getTime();
    const principal = isMaturity ? 100 * amortizationFactor : 0;

    cashFlows.push({
      date: dateStr,
      yearFraction: t,
      amount: couponPerPeriod,
      principal,
      total: couponPerPeriod + principal,
    });

    curr.setUTCMonth(curr.getUTCMonth() + monthsPerPeriod);
  }

  // Ensure maturity date flow is present
  if (cashFlows.length === 0 || cashFlows[cashFlows.length - 1].date !== maturityDateStr) {
    const t = Math.max(0.001, calculateYearFraction(settlementDateStr, maturityDateStr, dayCount));
    cashFlows.push({
      date: maturityDateStr,
      yearFraction: t,
      amount: couponPerPeriod,
      principal: 100 * amortizationFactor,
      total: couponPerPeriod + 100 * amortizationFactor,
    });
  }

  return cashFlows;
}

/**
 * 4. Bond Present Value given yield
 */
export function calculatePvFromYield(
  cashFlows: CashFlow[],
  yieldRate: number,
  frequency: CouponFrequency
): number {
  let pv = 0;
  const m = frequency;
  for (const cf of cashFlows) {
    const discountFactor = Math.pow(1 + yieldRate / m, -m * cf.yearFraction);
    pv += cf.total * discountFactor;
  }
  return pv;
}

/**
 * Derivative of PV with respect to yield
 */
function calculateDpvFromYield(
  cashFlows: CashFlow[],
  yieldRate: number,
  frequency: CouponFrequency
): number {
  let dpv = 0;
  const m = frequency;
  for (const cf of cashFlows) {
    const factor = Math.pow(1 + yieldRate / m, -m * cf.yearFraction - 1);
    dpv += -cf.yearFraction * cf.total * factor;
  }
  return dpv;
}

/**
 * 5. Yield to Maturity (YTM) Solver via Newton-Raphson with Bisection safeguard
 */
export function solveYtm(
  dirtyPrice: number,
  cashFlows: CashFlow[],
  frequency: CouponFrequency,
  initialGuess: number = 0.05
): number {
  if (dirtyPrice <= 0 || cashFlows.length === 0) return 0;

  let y = initialGuess;
  const tolerance = 1e-7;
  const maxIterations = 50;

  // Newton-Raphson iteration
  for (let i = 0; i < maxIterations; i++) {
    const pv = calculatePvFromYield(cashFlows, y, frequency);
    const diff = pv - dirtyPrice;

    if (Math.abs(diff) < tolerance) {
      return Math.max(-0.05, Math.min(1.0, y));
    }

    const dpv = calculateDpvFromYield(cashFlows, y, frequency);
    if (Math.abs(dpv) < 1e-12) break;

    const delta = diff / dpv;
    y = y - delta;

    // Boundary check for sensible bond yields (-5% to +100%)
    if (y < -0.05 || y > 1.0) {
      // Fallback to bounded bisection
      return solveYtmBisection(dirtyPrice, cashFlows, frequency);
    }
  }

  return Math.max(-0.05, Math.min(1.0, y));
}

function solveYtmBisection(
  dirtyPrice: number,
  cashFlows: CashFlow[],
  frequency: CouponFrequency
): number {
  let low = -0.05;
  let high = 0.60;
  let mid = (low + high) / 2;

  for (let i = 0; i < 60; i++) {
    mid = (low + high) / 2;
    const pv = calculatePvFromYield(cashFlows, mid, frequency);
    if (Math.abs(pv - dirtyPrice) < 1e-6) return mid;

    // Price is inversely related to yield
    if (pv > dirtyPrice) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return mid;
}

/**
 * 6. Risk Metrics: Macaulay Duration, Modified Duration, Convexity, DV01
 */
export interface BondRiskMetrics {
  ytm: number;
  macaulayDuration: number;
  modifiedDuration: number;
  convexity: number;
  accruedInterest: number;
  dirtyPrice: number;
}

export function calculateBondRiskMetrics(
  cleanPrice: number,
  maturityDateStr: string,
  settlementDateStr: string,
  couponRate: number,
  frequency: CouponFrequency,
  dayCount: DayCountConvention,
  amortizationFactor: number = 1.0
): BondRiskMetrics {
  const { prevCouponDate, nextCouponDate, isPastMaturity } = getCouponDates(
    maturityDateStr,
    settlementDateStr,
    frequency
  );

  if (isPastMaturity) {
    return {
      ytm: 0,
      macaulayDuration: 0,
      modifiedDuration: 0,
      convexity: 0,
      accruedInterest: 0,
      dirtyPrice: 100,
    };
  }

  const accrued = calculateAccruedInterest(
    couponRate,
    frequency,
    dayCount,
    settlementDateStr,
    prevCouponDate,
    nextCouponDate
  );

  const dirtyPrice = cleanPrice + accrued;
  const cashFlows = generateCashFlows(
    maturityDateStr,
    settlementDateStr,
    couponRate,
    frequency,
    dayCount,
    amortizationFactor
  );

  if (cashFlows.length === 0 || dirtyPrice <= 0) {
    return {
      ytm: 0,
      macaulayDuration: 0,
      modifiedDuration: 0,
      convexity: 0,
      accruedInterest: accrued,
      dirtyPrice,
    };
  }

  const ytm = solveYtm(dirtyPrice, cashFlows, frequency);
  const m = frequency;

  let weightedTimePv = 0;
  let convexitySum = 0;

  for (const cf of cashFlows) {
    const discount = Math.pow(1 + ytm / m, -m * cf.yearFraction);
    const pvCf = cf.total * discount;
    weightedTimePv += cf.yearFraction * pvCf;
    convexitySum += cf.yearFraction * (cf.yearFraction + 1 / m) * pvCf;
  }

  const macaulayDuration = dirtyPrice > 0 ? weightedTimePv / dirtyPrice : 0;
  const modifiedDuration = macaulayDuration / (1 + ytm / m);
  const convexity = dirtyPrice > 0 ? convexitySum / (dirtyPrice * Math.pow(1 + ytm / m, 2)) : 0;

  return {
    ytm,
    macaulayDuration: Math.max(0, macaulayDuration),
    modifiedDuration: Math.max(0, modifiedDuration),
    convexity: Math.max(0, convexity),
    accruedInterest: accrued,
    dirtyPrice,
  };
}

/**
 * 7. Foreign Exchange Rate Conversion Helpers
 */
export function getFxMultiplier(fromCcy: Currency, toCcy: Currency, fxRates: FxRate[]): number {
  if (fromCcy === toCcy) return 1.0;

  // Check direct pair e.g. "EUR/USD" (1 EUR = X USD)
  const directPair = `${fromCcy}/${toCcy}`;
  const direct = fxRates.find((r) => r.pair === directPair);
  if (direct) return direct.rate;

  // Check inverse pair e.g. "USD/EUR" (1 USD = X EUR => 1 EUR = 1/X USD)
  const inversePair = `${toCcy}/${fromCcy}`;
  const inverse = fxRates.find((r) => r.pair === inversePair);
  if (inverse && inverse.rate > 0) return 1.0 / inverse.rate;

  // Triangulation through USD
  if (fromCcy !== 'USD' && toCcy !== 'USD') {
    const fromToUsd = getFxMultiplier(fromCcy, 'USD', fxRates);
    const usdToTarget = getFxMultiplier('USD', toCcy, fxRates);
    return fromToUsd * usdToTarget;
  }

  // Default fallback realistic cross rates (1 unit of CCY in USD)
  const fallbackUsdRates: Record<string, number> = {
    USD: 1.0,
    EUR: 1.0835, // 1 EUR = 1.0835 USD
    GBP: 1.2865, // 1 GBP = 1.2865 USD
    CHF: 1.1312, // 1 CHF = 1.1312 USD
    JPY: 0.00656, // 1 JPY = 0.00656 USD (1 USD = 152.45 JPY)
    CAD: 0.7189, // 1 CAD = 0.7189 USD (1 USD = 1.3910 CAD)
    AUD: 0.6580, // 1 AUD = 0.6580 USD (1 USD = 1.5198 AUD)
    SEK: 0.0935, // 1 SEK = 0.0935 USD
    NOK: 0.0915, // 1 NOK = 0.0915 USD
    SGD: 0.7580, // 1 SGD = 0.7580 USD
  };

  const fromInUsd = fallbackUsdRates[fromCcy] !== undefined ? fallbackUsdRates[fromCcy] : 1.0;
  const toInUsd = fallbackUsdRates[toCcy] !== undefined ? fallbackUsdRates[toCcy] : 1.0;
  return fromInUsd / toInUsd;
}

/**
 * 8. Valuation for Structured Notes
 */

// Cap-Floor Floater (Collar Floater)
export function calculateCapFloorFloaterMetrics(
  floater: CapFloorFloater,
  cleanPrice: number,
  settlementDateStr: string,
  referenceRateFixing: number // e.g. 0.0410 for 4.10%
): BondRiskMetrics {
  const margin = floater.marginBps / 10000;
  const rawCoupon = referenceRateFixing + margin;
  const effectiveCoupon = Math.max(floater.floorLevel, Math.min(floater.capLevel, rawCoupon));

  const { prevCouponDate, nextCouponDate, isPastMaturity } = getCouponDates(
    floater.maturityDate,
    settlementDateStr,
    floater.resetFrequency
  );

  if (isPastMaturity) {
    return {
      ytm: 0,
      macaulayDuration: 0,
      modifiedDuration: 0,
      convexity: 0,
      accruedInterest: 0,
      dirtyPrice: 100,
    };
  }

  const accrued = calculateAccruedInterest(
    effectiveCoupon,
    floater.resetFrequency,
    floater.dayCount,
    settlementDateStr,
    prevCouponDate,
    nextCouponDate
  );

  const dirtyPrice = cleanPrice + accrued;
  // For floaters, duration is primarily the time to the next coupon/rate reset date
  const timeToReset = Math.max(0.01, calculateYearFraction(settlementDateStr, nextCouponDate, floater.dayCount));
  const modDuration = timeToReset / (1 + effectiveCoupon / floater.resetFrequency);

  return {
    ytm: effectiveCoupon,
    macaulayDuration: timeToReset,
    modifiedDuration: modDuration,
    convexity: 0.15, // Small positive convexity for capped floater
    accruedInterest: accrued,
    dirtyPrice,
  };
}

// Bond-Linked Note (Short Put Payoff Model)
export function calculateBondLinkedNoteMetrics(
  note: BondLinkedNote,
  cleanPrice: number,
  settlementDateStr: string
): BondRiskMetrics {
  const isPastExpiry = parseDate(settlementDateStr).getTime() >= parseDate(note.expiryDate).getTime();
  if (isPastExpiry) {
    return {
      ytm: 0,
      macaulayDuration: 0,
      modifiedDuration: 0,
      convexity: 0,
      accruedInterest: 0,
      dirtyPrice: 100,
    };
  }

  const { prevCouponDate, nextCouponDate } = getCouponDates(
    note.expiryDate,
    settlementDateStr,
    1 // Assume annual or at-expiry coupon
  );

  const accrued = calculateAccruedInterest(
    note.guaranteedCouponRate,
    1,
    note.dayCount,
    settlementDateStr,
    prevCouponDate,
    nextCouponDate
  );

  const dirtyPrice = cleanPrice + accrued;
  const timeToMaturity = Math.max(0.05, calculateYearFraction(settlementDateStr, note.expiryDate, note.dayCount));
  // High yield due to short put embedded premium
  const approxYield = (note.guaranteedCouponRate * 100 + (100 - cleanPrice) / timeToMaturity) / cleanPrice;
  const modDuration = timeToMaturity * 0.85; // Delta-adjusted duration

  return {
    ytm: Math.max(0, approxYield),
    macaulayDuration: timeToMaturity,
    modifiedDuration: Math.max(0, modDuration),
    convexity: -0.45, // Negative convexity due to embedded short put option
    accruedInterest: accrued,
    dirtyPrice,
  };
}

// Private Placement Note
export function calculatePrivatePlacementMetrics(
  note: PrivatePlacementNote,
  cleanPrice: number,
  settlementDateStr: string
): BondRiskMetrics {
  const isPast = parseDate(settlementDateStr).getTime() >= parseDate(note.maturityDate).getTime();
  if (isPast) {
    return {
      ytm: 0,
      macaulayDuration: 0,
      modifiedDuration: 0,
      convexity: 0,
      accruedInterest: 0,
      dirtyPrice: 100,
    };
  }

  const couponRate = note.fixedCouponRate || (note.marginBps ? note.marginBps / 10000 + 0.04 : 0.05);
  return calculateBondRiskMetrics(
    cleanPrice,
    note.maturityDate,
    settlementDateStr,
    couponRate,
    note.couponFrequency,
    note.dayCount
  );
}

/**
 * 9. Position-Level Complete Valuation
 */
export function valuatePosition(
  instrument: Instrument,
  quantity: number,
  costPrice: number,
  settlementDateStr: string,
  marketPrices: MarketPrice[],
  fxRates: FxRate[],
  baseCurrency: Currency
): PositionValuation {
  const fxToBase = getFxMultiplier(instrument.currency, baseCurrency, fxRates);
  const costBasisLocal = (costPrice / 100) * quantity;
  const costBasisBase = costBasisLocal * fxToBase;

  // Find market price or fallback to cost price
  const priceRecord = marketPrices.find((p) => p.isin === instrument.isin);
  const pricingMissing = !priceRecord;
  const cleanPrice = priceRecord ? priceRecord.cleanPrice : costPrice;

  let metrics: BondRiskMetrics;

  switch (instrument.assetClass) {
    case 'MutualFund': {
      const fund = instrument as MutualFund;
      const nav = cleanPrice; // For funds, cleanPrice represents NAV per share
      const dirtyPrice = nav;
      const effectiveDuration = fund.effectiveDuration || 4.2;
      metrics = {
        ytm: fund.dividendYield || 0.045,
        macaulayDuration: effectiveDuration,
        modifiedDuration: effectiveDuration,
        convexity: 0.25,
        accruedInterest: 0,
        dirtyPrice,
      };
      break;
    }
    case 'CapFloorFloater': {
      const floater = instrument as CapFloorFloater;
      metrics = calculateCapFloorFloaterMetrics(floater, cleanPrice, settlementDateStr, 0.043);
      break;
    }
    case 'BondLinkedNote': {
      const note = instrument as BondLinkedNote;
      metrics = calculateBondLinkedNoteMetrics(note, cleanPrice, settlementDateStr);
      break;
    }
    case 'PrivatePlacement': {
      const note = instrument as PrivatePlacementNote;
      metrics = calculatePrivatePlacementMetrics(note, cleanPrice, settlementDateStr);
      break;
    }
    case 'DirectBond':
    default: {
      const bond = instrument as DirectBond;
      metrics = calculateBondRiskMetrics(
        cleanPrice,
        bond.maturityDate,
        settlementDateStr,
        bond.couponRate,
        bond.couponFrequency,
        bond.dayCount,
        bond.amortizationFactor || 1.0
      );
      break;
    }
  }

  // Market Value Calculation:
  // For mutual funds: quantity = shares, marketValue = shares * NAV
  // For bonds & notes: quantity = par value, marketValue = (dirtyPrice / 100) * quantity
  const isFund = instrument.assetClass === 'MutualFund';
  const marketValueLocal = isFund ? quantity * metrics.dirtyPrice : (metrics.dirtyPrice / 100) * quantity;
  const marketValueBase = marketValueLocal * fxToBase;

  // DV01 = Market Value * Modified Duration * 0.0001
  const dv01Local = marketValueLocal * metrics.modifiedDuration * 0.0001;
  const dv01Base = marketValueBase * metrics.modifiedDuration * 0.0001;

  const unrealizedPnLBase = marketValueBase - costBasisBase;

  // Check maturity status
  let isMatured = false;
  if ('maturityDate' in instrument && instrument.maturityDate) {
    isMatured = parseDate(settlementDateStr).getTime() >= parseDate(instrument.maturityDate).getTime();
  } else if ('expiryDate' in instrument && instrument.expiryDate) {
    isMatured = parseDate(settlementDateStr).getTime() >= parseDate(instrument.expiryDate).getTime();
  }

  // Next coupon details
  let nextCouponDate: string | undefined;
  let nextCouponAmount: number | undefined;

  if ('maturityDate' in instrument && instrument.maturityDate && !isMatured) {
    const freq = 'couponFrequency' in instrument ? instrument.couponFrequency : ('resetFrequency' in instrument ? instrument.resetFrequency : 2);
    const dates = getCouponDates(instrument.maturityDate, settlementDateStr, freq as CouponFrequency);
    nextCouponDate = dates.nextCouponDate;
    if ('couponRate' in instrument) {
      nextCouponAmount = (instrument.couponRate / (freq as number)) * quantity;
    }
  }

  return {
    isin: instrument.isin,
    instrument,
    quantity,
    costBasis: costBasisBase,
    costPrice,
    cleanPrice,
    accruedInterestPct: metrics.accruedInterest,
    dirtyPrice: metrics.dirtyPrice,
    marketValueLocal,
    fxToBase,
    marketValueBase,
    portfolioWeight: 0, // Assigned at portfolio aggregation
    unrealizedPnLBase,
    costPnLPct: costBasisBase > 0 ? (unrealizedPnLBase / costBasisBase) * 100 : 0,
    ytdReturnPct: 0,
    mtdReturnPct: 0,
    ytm: metrics.ytm,
    ytw: ('callable' in instrument && instrument.callable) ? metrics.ytm * 0.92 : metrics.ytm,
    macaulayDuration: metrics.macaulayDuration,
    modifiedDuration: metrics.modifiedDuration,
    convexity: metrics.convexity,
    dv01Local,
    dv01Base,
    nextCouponDate,
    nextCouponAmount,
    isMatured,
    pricingMissing,
    illiquidFlag: 'illiquidValuationFlag' in instrument ? instrument.illiquidValuationFlag : false,
  };
}

/**
 * 10. Complete Portfolio Aggregation & Analytics
 */
export function aggregatePortfolio(
  positions: PositionValuation[],
  cashBalances: Record<Currency, number>,
  valuationDateStr: string,
  snapshotDateStr: string,
  baseCurrency: Currency,
  fxRates: FxRate[],
  instruments: Instrument[],
  snapshot?: InceptionSnapshot | null,
  transactions?: Transaction[]
): PortfolioValuationResult {
  const warnings: string[] = [];

  // Filter out zero-quantity or matured positions with zero balance
  const activePositions = positions.filter((p) => p.quantity > 0);

  // Total Holdings Market Value
  const totalHoldingsValue = activePositions.reduce((sum, p) => sum + p.marketValueBase, 0);

  // Total Cash in Base Currency across all currencies present in portfolio
  let totalCashValue = 0;
  const allCashCurrencies = Array.from(
    new Set([
      ...Object.keys(cashBalances),
      ...activePositions.map((p) => p.instrument.currency),
    ])
  ) as Currency[];

  for (const ccy of allCashCurrencies) {
    const bal = cashBalances[ccy] || 0;
    const fx = getFxMultiplier(ccy, baseCurrency, fxRates);
    totalCashValue += bal * fx;
  }

  const totalPortfolioValue = totalHoldingsValue + totalCashValue;

  // Calculate weights & weighted metrics
  let weightedYtm = 0;
  let weightedDuration = 0;
  let weightedMacaulay = 0;
  let weightedConvexity = 0;
  let weightedCoupon = 0;
  let totalDv01 = 0;
  let totalCostBasis = 0;

  for (const pos of activePositions) {
    pos.portfolioWeight = totalPortfolioValue > 0 ? (pos.marketValueBase / totalPortfolioValue) * 100 : 0;
    const holdingsWeight = totalHoldingsValue > 0 ? pos.marketValueBase / totalHoldingsValue : 0;

    weightedYtm += pos.ytm * holdingsWeight;
    weightedDuration += pos.modifiedDuration * holdingsWeight;
    weightedMacaulay += pos.macaulayDuration * holdingsWeight;
    weightedConvexity += pos.convexity * holdingsWeight;
    totalDv01 += pos.dv01Base;
    totalCostBasis += pos.costBasis;

    // Coupon weight
    if ('couponRate' in pos.instrument) {
      weightedCoupon += pos.instrument.couponRate * holdingsWeight;
    } else if ('currentCouponRate' in pos.instrument) {
      weightedCoupon += pos.instrument.currentCouponRate * holdingsWeight;
    } else if ('dividendYield' in pos.instrument && pos.instrument.dividendYield) {
      weightedCoupon += pos.instrument.dividendYield * holdingsWeight;
    }

    if (pos.pricingMissing) {
      warnings.push(`Market price missing for ${pos.instrument.isin} (${pos.instrument.name}). Cost price used.`);
    }
    if (pos.isMatured) {
      warnings.push(`Instrument ${pos.instrument.isin} has matured as of valuation date ${valuationDateStr}.`);
    }
  }

  const unrealizedPnL = totalHoldingsValue - totalCostBasis;

  // 11. Risk Aggregations (Sector, Rating, Counterparty, Currency, Asset Type, Payment Rank)
  const buildAggregation = (groupBy: (p: PositionValuation) => string): RiskAggregation[] => {
    const map = new Map<string, { mv: number; weightedDur: number; weightedYtm: number; dv01: number }>();

    for (const pos of activePositions) {
      const key = groupBy(pos);
      const existing = map.get(key) || { mv: 0, weightedDur: 0, weightedYtm: 0, dv01: 0 };
      existing.mv += pos.marketValueBase;
      existing.weightedDur += pos.modifiedDuration * pos.marketValueBase;
      existing.weightedYtm += pos.ytm * pos.marketValueBase;
      existing.dv01 += pos.dv01Base;
      map.set(key, existing);
    }

    const results: RiskAggregation[] = [];
    for (const [category, data] of map.entries()) {
      const weight = totalPortfolioValue > 0 ? (data.mv / totalPortfolioValue) * 100 : 0;
      const avgDur = data.mv > 0 ? data.weightedDur / data.mv : 0;
      const avgYtm = data.mv > 0 ? data.weightedYtm / data.mv : 0;
      results.push({
        category,
        marketValue: data.mv,
        portfolioWeight: weight,
        weightedDuration: avgDur,
        weightedYtm: avgYtm,
        dv01: data.dv01,
      });
    }

    return results.sort((a, b) => b.marketValue - a.marketValue);
  };

  const bySector = buildAggregation((p) => p.instrument.sector || 'Other');

  // Credit Rating order hierarchy
  const ratingOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'B', 'CCC', 'NR'];
  const byRatingRaw = buildAggregation((p) => p.instrument.creditRating || 'NR');
  const byRating = byRatingRaw.sort((a, b) => {
    const idxA = ratingOrder.indexOf(a.category);
    const idxB = ratingOrder.indexOf(b.category);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  const byCounterparty = buildAggregation((p) => p.instrument.issuer || 'Unknown');
  const byCurrency = buildAggregation((p) => p.instrument.currency);
  const byAssetClass = buildAggregation((p) => {
    switch (p.instrument.assetClass) {
      case 'DirectBond': return 'Direct Bonds';
      case 'MutualFund': return 'Mutual Funds';
      case 'CapFloorFloater': return 'Cap-Floor Floaters';
      case 'BondLinkedNote': return 'Bond-Linked Notes';
      case 'PrivatePlacement': return 'Private Placements';
      default: return 'Other';
    }
  });

  // Payment Rank (Capital Structure Seniority) Distribution
  const paymentRankOrder = [
    'Sovereign / Super Senior',
    'Senior Secured',
    'Senior Unsecured',
    'Subordinated / Tier 2',
    'Junior / Structured Note',
    'Fund / Equity Tranche',
  ];
  const byPaymentRankRaw = buildAggregation((p) => p.instrument.paymentRank || 'Senior Unsecured');
  const byPaymentRank = byPaymentRankRaw.sort((a, b) => {
    const idxA = paymentRankOrder.indexOf(a.category);
    const idxB = paymentRankOrder.indexOf(b.category);
    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
  });

  // 12. The 9 Key Rate Durations (KRD) Calculation
  const KEY_RATE_TENORS: { tenor: '6M' | '1Y' | '2Y' | '3Y' | '5Y' | '7Y' | '10Y' | '20Y' | '30Y'; years: number }[] = [
    { tenor: '6M', years: 0.5 },
    { tenor: '1Y', years: 1.0 },
    { tenor: '2Y', years: 2.0 },
    { tenor: '3Y', years: 3.0 },
    { tenor: '5Y', years: 5.0 },
    { tenor: '7Y', years: 7.0 },
    { tenor: '10Y', years: 10.0 },
    { tenor: '20Y', years: 20.0 },
    { tenor: '30Y', years: 30.0 },
  ];

  const portfolioKrdSums = new Array(KEY_RATE_TENORS.length).fill(0);

  for (const pos of activePositions) {
    const posHoldingsWeight = totalHoldingsValue > 0 ? pos.marketValueBase / totalHoldingsValue : 0;
    const dur = pos.modifiedDuration;

    // Use Macaulay duration / centroid as time anchor for tent interpolation
    const t = Math.max(0.1, pos.macaulayDuration || 1.0);

    if (t <= KEY_RATE_TENORS[0].years) {
      portfolioKrdSums[0] += dur * posHoldingsWeight;
    } else if (t >= KEY_RATE_TENORS[KEY_RATE_TENORS.length - 1].years) {
      portfolioKrdSums[KEY_RATE_TENORS.length - 1] += dur * posHoldingsWeight;
    } else {
      // Find interval [k, k+1]
      for (let k = 0; k < KEY_RATE_TENORS.length - 1; k++) {
        const t1 = KEY_RATE_TENORS[k].years;
        const t2 = KEY_RATE_TENORS[k + 1].years;
        if (t >= t1 && t <= t2) {
          const w2 = (t - t1) / (t2 - t1);
          const w1 = 1 - w2;
          portfolioKrdSums[k] += w1 * dur * posHoldingsWeight;
          portfolioKrdSums[k + 1] += w2 * dur * posHoldingsWeight;
          break;
        }
      }
    }
  }

  const keyRateDurations = KEY_RATE_TENORS.map((krt, idx) => {
    const duration = portfolioKrdSums[idx];
    const dv01 = totalPortfolioValue * duration * 0.0001;
    const percentage = weightedDuration > 0 ? (duration / weightedDuration) * 100 : 0;
    return {
      tenor: krt.tenor,
      years: krt.years,
      duration,
      dv01,
      percentage,
    };
  });

  // 13. Distribution of Holdings in Bins on Coupon Rates
  const COUPON_BINS = [
    { label: '0.00% – 2.00%', min: 0.0, max: 0.02 },
    { label: '2.00% – 3.50%', min: 0.02, max: 0.035 },
    { label: '3.50% – 4.50%', min: 0.035, max: 0.045 },
    { label: '4.50% – 5.50%', min: 0.045, max: 0.055 },
    { label: '5.50% – 6.50%', min: 0.055, max: 0.065 },
    { label: '6.50%+', min: 0.065, max: 1.0 },
  ];

  const binAccumulators = COUPON_BINS.map((b) => ({
    binLabel: b.label,
    minCoupon: b.min,
    maxCoupon: b.max,
    marketValue: 0,
    portfolioWeight: 0,
    holdingsCount: 0,
    weightedDurSum: 0,
    weightedCouponSum: 0,
  }));

  for (const pos of activePositions) {
    let rate = 0.04;
    if ('couponRate' in pos.instrument) {
      rate = pos.instrument.couponRate;
    } else if ('currentCouponRate' in pos.instrument) {
      rate = pos.instrument.currentCouponRate;
    } else if ('dividendYield' in pos.instrument && pos.instrument.dividendYield) {
      rate = pos.instrument.dividendYield;
    }

    // Match bin
    let targetBin = binAccumulators[binAccumulators.length - 1];
    for (const b of binAccumulators) {
      if (rate >= b.minCoupon && rate < b.maxCoupon) {
        targetBin = b;
        break;
      }
    }

    targetBin.marketValue += pos.marketValueBase;
    targetBin.holdingsCount += 1;
    targetBin.weightedDurSum += pos.modifiedDuration * pos.marketValueBase;
    targetBin.weightedCouponSum += rate * pos.marketValueBase;
  }

  const couponDistributions = binAccumulators.map((b) => ({
    binLabel: b.binLabel,
    minCoupon: b.minCoupon,
    maxCoupon: b.maxCoupon,
    marketValue: b.marketValue,
    portfolioWeight: totalPortfolioValue > 0 ? (b.marketValue / totalPortfolioValue) * 100 : 0,
    holdingsCount: b.holdingsCount,
    weightedDuration: b.marketValue > 0 ? b.weightedDurSum / b.marketValue : 0,
    weightedCoupon: b.marketValue > 0 ? b.weightedCouponSum / b.marketValue : 0,
  }));

  // 14. Floating-Rate Schedule
  const valDate = parseDate(valuationDateStr);
  const floatingResets: FloatingRateResetEvent[] = [];

  for (const pos of activePositions) {
    if (pos.instrument.assetClass === 'CapFloorFloater') {
      const f = pos.instrument as CapFloorFloater;
      const nextDate = parseDate(f.nextResetDate);
      const days = daysBetweenDates(valDate, nextDate);
      floatingResets.push({
        isin: f.isin,
        instrumentName: f.name,
        referenceRate: f.referenceRate,
        marginBps: f.marginBps,
        capLevel: f.capLevel,
        floorLevel: f.floorLevel,
        currentFixing: 0.0425,
        currentCouponRate: f.currentCouponRate,
        nextResetDate: f.nextResetDate,
        daysToReset: days,
        estimatedNextCoupon: ((f.currentCouponRate / f.resetFrequency) * pos.quantity),
        currency: f.currency,
        notional: pos.quantity,
      });
    } else if (pos.instrument.assetClass === 'PrivatePlacement') {
      const p = pos.instrument as PrivatePlacementNote;
      if (p.isFloater && p.referenceRate) {
        const nextDate = parseDate(pos.nextCouponDate || p.maturityDate);
        const days = daysBetweenDates(valDate, nextDate);
        const rate = (p.marginBps || 150) / 10000 + 0.043;
        floatingResets.push({
          isin: p.isin,
          instrumentName: p.name,
          referenceRate: p.referenceRate,
          marginBps: p.marginBps || 0,
          capLevel: 0.07,
          floorLevel: 0.02,
          currentFixing: 0.043,
          currentCouponRate: rate,
          nextResetDate: pos.nextCouponDate || p.maturityDate,
          daysToReset: days,
          estimatedNextCoupon: (rate / p.couponFrequency) * pos.quantity,
          currency: p.currency,
          notional: pos.quantity,
        });
      }
    }
  }

  floatingResets.sort((a, b) => a.daysToReset - b.daysToReset);

  // 15. Total Return, Price Return & Coupon Return Attribution (YTD, QTD, MTD)
  const dVal = parseDate(valuationDateStr);
  const curYear = dVal.getUTCFullYear();
  const curMonth = dVal.getUTCMonth(); // 0-indexed

  // Calculate standard period boundary start dates
  const priorYearEnd = `${curYear - 1}-12-31`;
  const ytdStart = snapshotDateStr > priorYearEnd ? snapshotDateStr : priorYearEnd;

  let qtdStart = priorYearEnd;
  if (curMonth >= 9) qtdStart = `${curYear}-09-30`;
  else if (curMonth >= 6) qtdStart = `${curYear}-06-30`;
  else if (curMonth >= 3) qtdStart = `${curYear}-03-31`;
  else qtdStart = priorYearEnd;
  if (snapshotDateStr > qtdStart) qtdStart = snapshotDateStr;

  let mtdStart = '';
  if (curMonth === 0) {
    mtdStart = priorYearEnd;
  } else {
    const prevMonthEnd = new Date(Date.UTC(curYear, curMonth, 0));
    mtdStart = formatDate(prevMonthEnd);
  }
  if (snapshotDateStr > mtdStart) mtdStart = snapshotDateStr;

  const snapMap = new Map<string, SnapshotPosition>();
  if (snapshot?.positions) {
    for (const sp of snapshot.positions) {
      snapMap.set(sp.isin, sp);
    }
  }

  const couponTxs = (transactions || []).filter((tx) => tx.type === 'COUPON');

  const computeSinglePeriod = (
    startDate: string,
    period: 'YTD' | 'QTD' | 'MTD',
    label: string
  ): {
    periodReturn: PeriodReturn;
    securityMap: Map<string, { rTotal: number; rPrice: number; rCoupon: number }>;
  } => {
    let weightedTotalReturn = 0;
    let weightedPriceReturn = 0;
    let weightedCouponReturn = 0;
    const securityMap = new Map<string, { rTotal: number; rPrice: number; rCoupon: number }>();

    const daysInPeriod = Math.max(1, daysBetweenDates(parseDate(startDate), dVal));

    for (const pos of activePositions) {
      const snapPos = snapMap.get(pos.isin);
      const isFund = pos.instrument.assetClass === 'MutualFund';

      const pCleanEnd = pos.cleanPrice;
      const aiEnd = isFund ? 0 : pos.accruedInterestPct;
      const pDirtyEnd = pCleanEnd + aiEnd;

      let pCleanStart = pos.costPrice;
      let aiStart = 0;

      if (period === 'YTD') {
        pCleanStart = snapPos ? snapPos.bookPrice : pos.costPrice;
        aiStart = isFund ? 0 : (snapPos ? snapPos.accruedInterestT0 : 0);
      } else {
        const totalYtdPriceDiff = pCleanEnd - (snapPos ? snapPos.bookPrice : pos.costPrice);
        const ytdDays = Math.max(1, daysBetweenDates(parseDate(ytdStart), dVal));
        const periodFractionOfYtd = Math.min(1.0, daysInPeriod / ytdDays);
        pCleanStart = pCleanEnd - (totalYtdPriceDiff * periodFractionOfYtd);

        if (!isFund) {
          const freq = 'couponFrequency' in pos.instrument ? pos.instrument.couponFrequency : ('resetFrequency' in pos.instrument ? pos.instrument.resetFrequency : 2);
          const rate = 'couponRate' in pos.instrument ? pos.instrument.couponRate : ('currentCouponRate' in pos.instrument ? pos.instrument.currentCouponRate : 0.04);
          const dayCount: DayCountConvention = ('dayCount' in pos.instrument && pos.instrument.dayCount) ? pos.instrument.dayCount : '30/360';
          const mat = ('maturityDate' in pos.instrument && pos.instrument.maturityDate) || ('expiryDate' in pos.instrument && pos.instrument.expiryDate) || '2030-01-01';
          const datesStart = getCouponDates(mat, startDate, freq as CouponFrequency);
          aiStart = calculateAccruedInterest(rate, freq as CouponFrequency, dayCount, startDate, datesStart.prevCouponDate, datesStart.nextCouponDate);
        }
      }

      const pDirtyStart = Math.max(0.01, pCleanStart + aiStart);

      // Coupons received during this period
      const periodCoupons = couponTxs
        .filter((tx) => tx.isin === pos.isin && tx.tradeDate > startDate && tx.tradeDate <= valuationDateStr)
        .reduce((sum, tx) => sum + tx.grossAmount, 0);

      const couponPer100Par = pos.quantity > 0 ? (periodCoupons / pos.quantity) * 100 : 0;

      // Price Return % = (P_clean_end - P_clean_start) / P_dirty_start
      const rPrice = ((pCleanEnd - pCleanStart) / pDirtyStart) * 100;

      // Coupon / Income Return % = (Accrued_Interest_Delta + Coupons_Received) / P_dirty_start
      const rCoupon = (((aiEnd - aiStart) + couponPer100Par) / pDirtyStart) * 100;

      // Total Return % = Price Return + Coupon Return (exact additivity)
      const rTotal = rPrice + rCoupon;

      securityMap.set(pos.isin, { rTotal, rPrice, rCoupon });

      const weight = totalHoldingsValue > 0 ? pos.marketValueBase / totalHoldingsValue : 0;
      weightedTotalReturn += rTotal * weight;
      weightedPriceReturn += rPrice * weight;
      weightedCouponReturn += rCoupon * weight;
    }

    return {
      periodReturn: {
        period,
        label,
        startDate,
        endDate: valuationDateStr,
        totalReturnPct: weightedTotalReturn,
        priceReturnPct: weightedPriceReturn,
        couponReturnPct: weightedCouponReturn,
        totalReturnDollar: totalHoldingsValue * (weightedTotalReturn / 100),
        priceReturnDollar: totalHoldingsValue * (weightedPriceReturn / 100),
        couponReturnDollar: totalHoldingsValue * (weightedCouponReturn / 100),
      },
      securityMap,
    };
  };

  const ytdRes = computeSinglePeriod(ytdStart, 'YTD', 'Year-to-Date (YTD)');
  const qtdRes = computeSinglePeriod(qtdStart, 'QTD', 'Quarter-to-Date (QTD)');
  const mtdRes = computeSinglePeriod(mtdStart, 'MTD', 'Month-to-Date (MTD)');

  const ytd = ytdRes.periodReturn;
  const qtd = qtdRes.periodReturn;
  const mtd = mtdRes.periodReturn;

  // Populate costPnLPct, ytdReturnPct, and mtdReturnPct on activePositions
  for (const pos of activePositions) {
    pos.costPnLPct = pos.costBasis > 0 ? (pos.unrealizedPnLBase / pos.costBasis) * 100 : 0;
    pos.ytdReturnPct = ytdRes.securityMap.get(pos.isin)?.rTotal ?? 0;
    pos.mtdReturnPct = mtdRes.securityMap.get(pos.isin)?.rTotal ?? 0;
  }

  const securityReturns: SecurityPeriodReturn[] = activePositions.map((pos) => {
    const snapPos = snapMap.get(pos.isin);
    const isFund = pos.instrument.assetClass === 'MutualFund';
    const pCleanEnd = pos.cleanPrice;
    const aiEnd = isFund ? 0 : pos.accruedInterestPct;
    const pCleanStart = snapPos ? snapPos.bookPrice : pos.costPrice;
    const aiStart = isFund ? 0 : (snapPos ? snapPos.accruedInterestT0 : 0);
    const pDirtyStart = Math.max(0.01, pCleanStart + aiStart);

    const periodCoupons = couponTxs
      .filter((tx) => tx.isin === pos.isin && tx.tradeDate > ytdStart && tx.tradeDate <= valuationDateStr)
      .reduce((sum, tx) => sum + tx.grossAmount, 0);

    const couponPer100Par = pos.quantity > 0 ? (periodCoupons / pos.quantity) * 100 : 0;

    const rPrice = ((pCleanEnd - pCleanStart) / pDirtyStart) * 100;
    const rCoupon = (((aiEnd - aiStart) + couponPer100Par) / pDirtyStart) * 100;
    const rTotal = rPrice + rCoupon;

    const weight = totalHoldingsValue > 0 ? pos.marketValueBase / totalHoldingsValue : 0;
    const portfolioWeightPct = weight * 100;
    const contributedReturnPct = rTotal * weight;
    const contributedReturnBps = contributedReturnPct * 100;
    const contributedPricePct = rPrice * weight;
    const contributedCouponPct = rCoupon * weight;
    const dollarContributionBase = totalHoldingsValue * (contributedReturnPct / 100);

    return {
      isin: pos.isin,
      name: pos.instrument.name,
      currency: pos.instrument.currency,
      assetClass: pos.instrument.assetClass,
      totalReturnPct: rTotal,
      priceReturnPct: rPrice,
      couponReturnPct: rCoupon,
      marketValueBase: pos.marketValueBase,
      portfolioWeightPct,
      contributedReturnPct,
      contributedReturnBps,
      contributedPricePct,
      contributedCouponPct,
      dollarContributionBase,
    };
  }).sort((a, b) => b.contributedReturnPct - a.contributedReturnPct);

  // 16. Asset Class Contributed Return Aggregation (Strengths & Weaknesses)
  const ASSET_CLASS_SPECS: { assetClass: AssetClass; label: string }[] = [
    { assetClass: 'DirectBond', label: 'Direct Bond' },
    { assetClass: 'MutualFund', label: 'Mutual Fund' },
    { assetClass: 'CapFloorFloater', label: 'CapFloor Floater' },
    { assetClass: 'BondLinkedNote', label: 'BondLinkedNote' },
    { assetClass: 'PrivatePlacement', label: 'PrivatePlacement' },
  ];

  const assetClassContributions: AssetClassReturnContribution[] = ASSET_CLASS_SPECS.map((spec) => {
    const classPositions = securityReturns.filter((sr) => sr.assetClass === spec.assetClass);
    const classMv = classPositions.reduce((s, p) => s + p.marketValueBase, 0);
    const classWeight = totalHoldingsValue > 0 ? (classMv / totalHoldingsValue) * 100 : 0;
    const contributedReturnPct = classPositions.reduce((s, p) => s + p.contributedReturnPct, 0);
    const contributedReturnBps = contributedReturnPct * 100;
    const contributedPricePct = classPositions.reduce((s, p) => s + p.contributedPricePct, 0);
    const contributedCouponPct = classPositions.reduce((s, p) => s + p.contributedCouponPct, 0);
    const dollarContributionBase = classPositions.reduce((s, p) => s + p.dollarContributionBase, 0);
    const averageReturnPct = classWeight > 0 ? contributedReturnPct / (classWeight / 100) : 0;

    const sortedStrengths = [...classPositions].sort((a, b) => b.contributedReturnPct - a.contributedReturnPct);
    const sortedWeaknesses = [...classPositions].sort((a, b) => a.contributedReturnPct - b.contributedReturnPct);

    return {
      assetClass: spec.assetClass,
      label: spec.label,
      marketValueBase: classMv,
      portfolioWeightPct: classWeight,
      positionsCount: classPositions.length,
      averageReturnPct,
      contributedReturnPct,
      contributedReturnBps,
      contributedCouponPct,
      contributedPricePct,
      dollarContributionBase,
      topStrengths: sortedStrengths.slice(0, 3),
      topWeaknesses: sortedWeaknesses.slice(0, 3),
      positions: sortedStrengths,
    };
  });

  return {
    asOfDate: valuationDateStr,
    snapshotDate: snapshotDateStr,
    baseCurrency,
    totalPortfolioValue,
    totalHoldingsValue,
    totalCashValue,
    cashBalances,
    unrealizedPnL,
    weightedYtm,
    weightedDuration,
    weightedMacaulayDuration: weightedMacaulay,
    weightedConvexity,
    weightedCoupon,
    totalDv01,
    positions: activePositions,
    returns: {
      ytd,
      qtd,
      mtd,
      securityReturns,
      assetClassContributions,
    },
    keyRateDurations,
    couponDistributions,
    paymentRankDistributions: byPaymentRank,
    breakdowns: {
      bySector,
      byRating,
      byCounterparty,
      byCurrency,
      byAssetClass,
      byPaymentRank,
    },
    floatingResets,
    warnings,
  };
}
