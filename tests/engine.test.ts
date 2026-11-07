import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate,
  formatDate,
  addMonths,
  daysBetweenDates,
  calculateYearFraction,
  calculateAccruedInterest,
  generateCashFlows,
  calculatePvFromYield,
  solveYtm,
  calculateBondRiskMetrics,
  getFxMultiplier,
  calculateCapFloorFloaterMetrics,
  calculateBondLinkedNoteMetrics,
  calculatePrivatePlacementMetrics,
  valuatePosition,
  aggregatePortfolio,
  getCouponDates,
} from '../src/services/quantitativeEngine';
import {
  SAMPLE_INSTRUMENTS,
  INITIAL_SNAPSHOT_T0,
  SAMPLE_TRANSACTIONS,
  SAMPLE_MARKET_PRICES,
  SAMPLE_FX_RATES,
  SAMPLE_YIELD_CURVES,
} from '../src/services/sampleData';
import { sqliteService } from '../src/services/sqliteStorage';
import type { DirectBond, CapFloorFloater, BondLinkedNote, PrivatePlacementNote } from '../src/types/portfolio';

describe('Fixed Income Quantitative Engine', () => {
  test('Date utilities and year fraction calculations', () => {
    const d1 = parseDate('2026-01-15');
    assert.equal(formatDate(d1), '2026-01-15');
    assert.equal(addMonths('2026-01-15', 3), '2026-04-15');
    assert.equal(addMonths('2026-01-15', 6), '2026-07-15');

    const d2 = parseDate('2026-07-15');
    const days = daysBetweenDates(d1, d2);
    assert.equal(days, 181);

    const yfAct360 = calculateYearFraction('2026-01-15', '2026-07-15', 'Act/360');
    assert.ok(Math.abs(yfAct360 - 181 / 360) < 1e-6);

    const yf30360 = calculateYearFraction('2026-01-15', '2026-07-15', '30/360');
    assert.ok(Math.abs(yf30360 - 0.5) < 1e-4);
  });

  test('Coupon dates and accrued interest calculation', () => {
    // 5% coupon, Semi-Annual (2), 30/360
    const couponDates = getCouponDates('2030-05-15', '2026-08-15', 2);
    assert.equal(couponDates.prevCouponDate, '2026-05-15');
    assert.equal(couponDates.nextCouponDate, '2026-11-15');

    // Midway through 6 months (3 months accrued)
    const accrued = calculateAccruedInterest(
      0.05,
      2,
      '30/360',
      '2026-08-15',
      couponDates.prevCouponDate,
      couponDates.nextCouponDate
    );
    assert.ok(accrued > 0, 'Accrued interest should be positive');
    // 5% * 100 * (90/360) = 1.25 per 100 par
    assert.ok(Math.abs(accrued - 1.25) < 0.05, `Expected ~1.25, got ${accrued}`);
  });

  test('Cashflow generation, YTM solver, and risk metrics', () => {
    const maturity = '2030-05-15';
    const valDate = '2026-11-02';
    const couponRate = 0.0425;
    const freq = 2;
    const dayCount = 'Act/Act';

    const cfs = generateCashFlows(maturity, valDate, couponRate, freq, dayCount);
    assert.ok(cfs.length > 0, 'Should generate future cash flows');
    assert.equal(cfs[cfs.length - 1].principal, 100, 'Final cash flow should include 100 par principal');

    // Risk metrics: duration and convexity
    const risk = calculateBondRiskMetrics(99.85, maturity, valDate, couponRate, freq, dayCount);
    assert.ok(risk.ytm > 0.03 && risk.ytm < 0.06, `YTM should be realistic, got ${risk.ytm}`);
    assert.ok(risk.modifiedDuration > 2 && risk.modifiedDuration < 5, `Duration should be ~3.4, got ${risk.modifiedDuration}`);
    assert.ok(risk.convexity > 0, 'Convexity must be positive');
    assert.ok(risk.dirtyPrice >= 99.85, 'Dirty price must include accrued');
  });

  test('Multi-currency triangulation and FX rates', () => {
    // Direct USD
    assert.equal(getFxMultiplier('USD', 'USD', SAMPLE_FX_RATES), 1.0);

    // Direct EUR/USD (~1.08)
    const eurToUsd = getFxMultiplier('EUR', 'USD', SAMPLE_FX_RATES);
    assert.ok(eurToUsd > 1.0 && eurToUsd < 1.2, `EUR/USD should be around 1.08, got ${eurToUsd}`);

    // Inverse USD/EUR
    const usdToEur = getFxMultiplier('USD', 'EUR', SAMPLE_FX_RATES);
    assert.ok(Math.abs(usdToEur - (1 / eurToUsd)) < 1e-4);

    // Cross JPY to EUR via USD pivot
    const jpyToEur = getFxMultiplier('JPY', 'EUR', SAMPLE_FX_RATES);
    assert.ok(jpyToEur > 0, 'Cross currency multiplier should be positive');
  });

  test('Structured notes metrics (FRNs, Bond-Linked, Private Placements)', () => {
    const frn = SAMPLE_INSTRUMENTS.find((i) => i.assetClass === 'CapFloorFloater') as CapFloorFloater;
    assert.ok(frn);
    const frnMetrics = calculateCapFloorFloaterMetrics(frn, 100.25, '2026-11-02', 0.045);
    assert.ok(frnMetrics.ytm > 0, 'FRN yield should be positive');
    assert.ok(frnMetrics.modifiedDuration < 1.0, 'Floater duration should be under 1 year');

    const bln = SAMPLE_INSTRUMENTS.find((i) => i.assetClass === 'BondLinkedNote') as BondLinkedNote;
    assert.ok(bln);
    const blnMetrics = calculateBondLinkedNoteMetrics(bln, 98.50, '2026-11-02');
    assert.ok(blnMetrics.modifiedDuration >= 0);

    const priv = SAMPLE_INSTRUMENTS.find((i) => i.assetClass === 'PrivatePlacement') as PrivatePlacementNote;
    assert.ok(priv);
    const privMetrics = calculatePrivatePlacementMetrics(priv, 100.0, '2026-11-02');
    assert.ok(privMetrics.modifiedDuration > 0);
  });

  test('SQLite service initialization, snapshot, and roll-forward', async () => {
    await sqliteService.init();

    const rolled = sqliteService.rollPortfolioState('2026-11-02');
    assert.ok(rolled.positions.length > 0, 'Rolled positions should not be empty');
    assert.ok(rolled.transactionsApplied >= 0, 'Transactions count should be non-negative');

    // Valuate all rolled holdings
    const instMap = new Map();
    for (const inst of SAMPLE_INSTRUMENTS) instMap.set(inst.isin, inst);

    const valuations = [];
    for (const r of rolled.positions) {
      const inst = instMap.get(r.isin);
      if (inst) {
        valuations.push(
          valuatePosition(
            inst,
            r.quantity,
            r.costPrice,
            '2026-11-02',
            SAMPLE_MARKET_PRICES,
            SAMPLE_FX_RATES,
            'USD'
          )
        );
      }
    }
    assert.equal(valuations.length, rolled.positions.length);

    // Aggregate portfolio
    const portfolio = aggregatePortfolio(
      valuations,
      rolled.cashBalances,
      '2026-11-02',
      INITIAL_SNAPSHOT_T0.snapshotDate,
      'USD',
      SAMPLE_FX_RATES,
      SAMPLE_INSTRUMENTS,
      INITIAL_SNAPSHOT_T0,
      SAMPLE_TRANSACTIONS
    );

    assert.ok(portfolio.totalPortfolioValue > 10000000, 'Portfolio value should be aggregated');
    assert.ok(portfolio.weightedDuration > 0, 'Weighted duration should be positive');
    assert.ok(portfolio.returns.assetClassContributions.length > 0, 'Attribution should be generated');
    assert.ok(portfolio.keyRateDurations.length > 0, 'KRD should be generated');
  });
});
