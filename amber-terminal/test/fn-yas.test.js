// Tests for Fixed Income YAS (Yield and Spread) bond pricing and risk calculations
import { test } from "node:test";
import assert from "node:assert/strict";
import yas, {
  bondPrice,
  bondYtm,
  durationAndConvexity,
  cashFlows,
  rateScenarios,
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

test("YAS: endpoint returns complete payload with benchmark spread", async () => {
  const res = await yas({ coupon: "5.0", years: "10", price: "98.5" });

  assert.equal(res.instrument.coupon, 5.0);
  assert.equal(res.instrument.years, 10);
  assert.equal(res.pricing.cleanPrice, 98.5);
  assert.ok(res.pricing.ytm > 5.0); // discount bond has YTM > coupon
  assert.ok(res.risk.modDuration > 0);
  assert.ok(res.risk.dv01 > 0);
  assert.equal(res.benchmark.tenor, "10Y");
  assert.ok(Array.isArray(res.scenarios));
  assert.ok(Array.isArray(res.cashFlows));
  assert.match(res.source, /Amber Terminal/);
});
