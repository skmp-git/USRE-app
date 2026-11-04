// Tests for Fixed Income YAS (Yield and Spread) bond pricing and risk calculations
// including Open Source Bond Asset Pricing (OSBAP) corporate bond methodologies
import { test } from "node:test";
import assert from "node:assert/strict";
import yas, {
  bondPrice,
  bondYtm,
  durationAndConvexity,
  accruedInterest,
  interpolateTreasuryCurve,
  cashFlows,
  rateScenarios,
  parseRating,
  PRESETS,
} from "../lib/fn/yas.js";

const close = (a, b, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`);

test("YAS: par bond price equals 100 when coupon equals YTM", () => {
  const p = bondPrice(5.0, 5.0, 10, 2, 100);
  close(p, 100.0, 1e-4);

  const ytm = bondYtm(100.0, 5.0, 10, 2, 100);
  close(ytm, 5.0, 1e-4);
});

test("YAS: discount and premium bond pricing", () => {
  // 5% coupon, 6% YTM -> price < 100 (discount)
  const discountPrice = bondPrice(6.0, 5.0, 10, 2, 100);
  assert.ok(discountPrice < 100);
  const discountYtm = bondYtm(discountPrice, 5.0, 10, 2, 100);
  close(discountYtm, 6.0, 1e-4);

  // 5% coupon, 4% YTM -> price > 100 (premium)
  const premiumPrice = bondPrice(4.0, 5.0, 10, 2, 100);
  assert.ok(premiumPrice > 100);
  const premiumYtm = bondYtm(premiumPrice, 5.0, 10, 2, 100);
  close(premiumYtm, 4.0, 1e-4);
});

test("YAS: zero coupon bond pricing", () => {
  // 10Y zero coupon at 5% semi-annual YTM: P = 100 / (1 + 0.025)^20
  const expected = 100 / Math.pow(1.025, 20);
  const p = bondPrice(5.0, 0.0, 10, 2, 100);
  close(p, expected, 1e-3);

  const ytm = bondYtm(p, 0.0, 10, 2, 100);
  close(ytm, 5.0, 1e-3);
});

test("YAS: duration, DV01 and convexity for a 5-year par bond", () => {
  const metrics = durationAndConvexity(100, 5.0, 5.0, 5, 2, 100);

  // For 5Y 5% semi-annual par bond:
  // Macaulay duration is approx 4.49 years
  close(metrics.macDuration, 4.49, 0.05);

  // Modified duration = 4.49 / 1.025 ≈ 4.38 years
  close(metrics.modDuration, 4.38, 0.05);

  // DV01 = 100 * 4.38 * 0.0001 ≈ 0.0438
  close(metrics.dv01, 0.0438, 0.001);

  // Convexity is approx 22.8
  close(metrics.convexity, 22.8, 1.0);
});

test("YAS: accrued interest (acclast) using 30/360 day count convention", () => {
  // 6% coupon, semi-annual (freq = 2), 60 days accrued out of 180 days in period
  const acc = accruedInterest(6.0, 2, 100, 60, "30/360");
  assert.equal(acc.daysAccrued, 60);
  assert.equal(acc.daysInPeriod, 180);
  close(acc.accruedFraction, 1 / 3, 1e-4);
  // Period coupon = 3.0, 1/3 accrued = 1.0
  close(acc.acclast, 1.0, 1e-4);
});

test("YAS: OSBAP ComputeCredit Treasury curve interpolation", () => {
  const curve = {
    "1Y": 4.5,
    "2Y": 4.0,
    "3Y": 4.1,
    "5Y": 4.2,
    "7Y": 4.3,
    "10Y": 4.4,
    "20Y": 4.6,
    "30Y": 4.5,
  };

  // Exact node match
  assert.equal(interpolateTreasuryCurve(2, curve), 4.0);
  assert.equal(interpolateTreasuryCurve(10, curve), 4.4);

  // Midpoint between 2Y (4.0) and 3Y (4.1) at 2.5Y => 4.05
  close(interpolateTreasuryCurve(2.5, curve), 4.05, 1e-3);

  // Midpoint between 5Y (4.2) and 7Y (4.3) at 6.0Y => 4.25
  close(interpolateTreasuryCurve(6.0, curve), 4.25, 1e-3);
});

test("YAS: rating parser supports S&P, Moody's, and numeric 1-22 codes", () => {
  const r1 = parseRating("AAA");
  assert.equal(r1.code, 1);
  assert.equal(r1.grade, "Investment Grade");

  const rBaa = parseRating("Baa2");
  assert.equal(rBaa.code, 9);
  assert.equal(rBaa.sp, "BBB");

  const rHyp = parseRating(11);
  assert.equal(rHyp.sp, "BB+");
  assert.equal(rHyp.grade, "High Yield");

  const rD = parseRating("D");
  assert.equal(rD.code, 22);
  assert.equal(rD.grade, "Default");
});

test("YAS: rate shock scenarios accurately reflect bond price moves", () => {
  const scenarios = rateScenarios(100, 5.0, 5.0, 10, 2, 100);
  assert.equal(scenarios.length, 6);

  const down100 = scenarios.find((s) => s.shiftBp === -100);
  const up100 = scenarios.find((s) => s.shiftBp === 100);

  // Bond price rises when rates fall
  assert.ok(down100.newPrice > 100);
  assert.ok(down100.pctChange > 0);

  // Bond price falls when rates rise
  assert.ok(up100.newPrice < 100);
  assert.ok(up100.pctChange < 0);

  // Convexity effect: gain from -100bp is greater than loss from +100bp
  assert.ok(Math.abs(down100.pctChange) > Math.abs(up100.pctChange));
});

test("YAS: cash flow schedule totals coupon and principal", () => {
  const flows = cashFlows(5.0, 4.0, 3, 2, 100);
  assert.equal(flows.length, 6);

  // Coupon per period: (4% * 100) / 2 = 2.00
  assert.equal(flows[0].coupon, 2.0);
  assert.equal(flows[0].principal, 0.0);
  assert.equal(flows[0].total, 2.0);

  // Final period has principal repayment
  assert.equal(flows[5].principal, 100.0);
  assert.equal(flows[5].total, 102.0);
});

test("YAS: corporate bond pricing with credit spread and CS01", async () => {
  const res = await yas({
    preset: "AAPL_2030",
    coupon: "4.30",
    years: "5.5",
    spreadBp: "65",
  });

  assert.equal(res.instrument.type, "corp");
  assert.equal(res.instrument.issuer, "Apple Inc.");
  assert.equal(res.instrument.cusip, "037833EK3");
  assert.equal(res.instrument.ratingGrade, "Investment Grade");
  assert.equal(res.credit.spreadBp, 65);
  assert.ok(res.credit.cs01 > 0);
  assert.ok(res.credit.cs01Per100k > 0);
  assert.ok(res.pricing.dirtyPrice > res.pricing.cleanPrice); // dirty price includes accrued interest
  assert.match(res.credit.methodology, /Open Source Bond Asset Pricing/);
});

test("YAS: preset securities list includes both Treasuries and Corporate bonds", () => {
  assert.ok(PRESETS.length >= 8);
  const treasuries = PRESETS.filter((p) => p.type === "govt");
  const corporates = PRESETS.filter((p) => p.type === "corp");

  assert.ok(treasuries.length >= 4);
  assert.ok(corporates.length >= 5);
  assert.ok(corporates.some((c) => c.issuer === "Apple Inc."));
  assert.ok(corporates.some((c) => c.issuer === "Microsoft Corp."));
  assert.ok(corporates.some((c) => c.issuer === "JPMorgan Chase & Co."));
});
