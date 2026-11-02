// /api/fn/yas : Fixed Income Yield & Spread (YAS) Bond Valuation and Risk Analytics.
// Calculates bond price, yield to maturity (YTM), Macaulay duration, modified duration,
// DV01, convexity, price sensitivity shock scenarios, cash flow schedules,
// and benchmark Treasury spreads against the US Treasury curve.
import gc from "./gc.js";

const fin = Number.isFinite;
const round = (v, d = 4) => (fin(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/**
 * Calculates bond price from YTM.
 * @param {number} ytm Annual yield to maturity in percent (e.g. 5.0 for 5%)
 * @param {number} coupon Annual coupon rate in percent (e.g. 4.5 for 4.5%)
 * @param {number} years Years to maturity (e.g. 10)
 * @param {number} freq Coupon frequency per year (default 2: semi-annual)
 * @param {number} face Par / face value (default 100)
 */
export function bondPrice(ytm, coupon, years, freq = 2, face = 100) {
  const n = Math.max(1, Math.round(years * freq));
  const c = (coupon / 100 * face) / freq;
  const y = (ytm / 100) / freq;

  if (Math.abs(y) < 1e-12) {
    return c * n + face;
  }

  let pv = 0;
  for (let k = 1; k <= n; k++) {
    pv += c / Math.pow(1 + y, k);
  }
  pv += face / Math.pow(1 + y, n);
  return pv;
}

/**
 * Solves for Yield to Maturity (YTM) given bond price using Newton-Raphson.
 * @param {number} price Target bond price
 * @param {number} coupon Annual coupon rate in percent
 * @param {number} years Years to maturity
 * @param {number} freq Coupon frequency per year
 * @param {number} face Par value
 */
export function bondYtm(price, coupon, years, freq = 2, face = 100) {
  if (price <= 0 || years <= 0) return null;
  const n = Math.max(1, Math.round(years * freq));
  const c = (coupon / 100 * face) / freq;

  // Initial guess using standard approximation
  let annualCoupon = (coupon / 100) * face;
  let approxYtm = (annualCoupon + (face - price) / years) / ((face + price) / 2);
  let y = Math.max(-0.99 / freq, approxYtm / freq);

  // Newton-Raphson iterations
  for (let iter = 0; iter < 100; iter++) {
    let f = 0;
    let df = 0;
    const inv1y = 1 / (1 + y);

    for (let k = 1; k <= n; k++) {
      const disc = Math.pow(inv1y, k);
      f += c * disc;
      df -= k * c * disc * inv1y;
    }
    const discN = Math.pow(inv1y, n);
    f += face * discN - price;
    df -= n * face * discN * inv1y;

    if (Math.abs(f) < 1e-8) break;
    if (Math.abs(df) < 1e-12) break;

    const dy = f / df;
    y -= dy;
    if (y <= -1) y = -0.999;
  }

  return y * freq * 100;
}

/**
 * Computes Macaulay duration, Modified duration, DV01, and Convexity.
 */
export function durationAndConvexity(price, ytm, coupon, years, freq = 2, face = 100) {
  const n = Math.max(1, Math.round(years * freq));
  const c = (coupon / 100 * face) / freq;
  const y = (ytm / 100) / freq;
  const inv1y = 1 / (1 + y);

  let weightedTime = 0;
  let convexitySum = 0;

  for (let k = 1; k <= n; k++) {
    const disc = Math.pow(inv1y, k);
    const cf = k === n ? c + face : c;
    weightedTime += (k / freq) * cf * disc;
    convexitySum += (k * (k + 1) / (freq * freq)) * cf * disc;
  }

  const macDuration = weightedTime / price;
  const modDuration = macDuration / (1 + y);
  const dv01 = (price * modDuration * 0.0001); // Dollar value of an 01 bp shift
  const convexity = convexitySum / (price * Math.pow(1 + y, 2));

  return {
    macDuration: round(macDuration, 3),
    modDuration: round(modDuration, 3),
    dv01: round(dv01, 4),
    convexity: round(convexity, 3),
  };
}

/**
 * Generates future cash flow breakdown.
 */
export function cashFlows(ytm, coupon, years, freq = 2, face = 100) {
  const n = Math.max(1, Math.round(years * freq));
  const c = (coupon / 100 * face) / freq;
  const y = (ytm / 100) / freq;
  const flows = [];

  for (let k = 1; k <= n; k++) {
    const periodYears = k / freq;
    const couponPmt = c;
    const principalPmt = k === n ? face : 0;
    const totalPmt = couponPmt + principalPmt;
    const disc = Math.pow(1 + y, -k);
    const pv = totalPmt * disc;

    flows.push({
      period: k,
      year: round(periodYears, 2),
      coupon: round(couponPmt, 2),
      principal: round(principalPmt, 2),
      total: round(totalPmt, 2),
      disc: round(disc, 5),
      pv: round(pv, 2),
    });
  }
  return flows;
}

/**
 * Generates rate shock scenario matrix.
 */
export function rateScenarios(basePrice, baseYtm, coupon, years, freq = 2, face = 100) {
  const shiftsBp = [-100, -50, -25, +25, +50, +100];
  const dur = durationAndConvexity(basePrice, baseYtm, coupon, years, freq, face);

  return shiftsBp.map((shift) => {
    const newYtm = baseYtm + shift / 100;
    const newPrice = bondPrice(newYtm, coupon, years, freq, face);
    const dPrice = newPrice - basePrice;
    const pctChange = (dPrice / basePrice) * 100;

    // Taylor series approximation (Duration + Convexity)
    const dy = shift / 10000;
    const estPctChange = (-dur.modDuration * dy + 0.5 * dur.convexity * dy * dy) * 100;
    const estPrice = basePrice * (1 + estPctChange / 100);

    return {
      shiftBp: shift,
      newYtm: round(newYtm, 3),
      newPrice: round(newPrice, 3),
      dPrice: round(dPrice, 3),
      pctChange: round(pctChange, 2),
      estPrice: round(estPrice, 3),
    };
  });
}

// Preset securities for instant fixed income analysis
export const PRESETS = [
  { id: "US2Y", name: "US Treasury 2Y Note", years: 2, coupon: 4.25, freq: 2, benchmark: "2Y" },
  { id: "US5Y", name: "US Treasury 5Y Note", years: 5, coupon: 4.125, freq: 2, benchmark: "5Y" },
  { id: "US10Y", name: "US Treasury 10Y Note", years: 10, coupon: 4.5, freq: 2, benchmark: "10Y" },
  { id: "US30Y", name: "US Treasury 30Y Bond", years: 30, coupon: 4.625, freq: 2, benchmark: "30Y" },
  { id: "IG5Y", name: "Investment Grade Corp 5Y", years: 5, coupon: 5.5, freq: 2, benchmark: "5Y" },
  { id: "HY7Y", name: "High Yield Corp 7Y", years: 7, coupon: 7.5, freq: 2, benchmark: "7Y" },
  { id: "ZERO10Y", name: "Zero Coupon 10Y", years: 10, coupon: 0.0, freq: 1, benchmark: "10Y" },
];

export default async function (q = {}) {
  let coupon = q.coupon != null ? parseFloat(q.coupon) : 4.5;
  let years = q.years != null ? parseFloat(q.years) : 10;
  let freq = q.freq != null ? parseInt(q.freq, 10) : 2;
  const face = q.face != null ? parseFloat(q.face) : 100;

  if (!fin(coupon) || coupon < 0) coupon = 4.5;
  if (!fin(years) || years <= 0) years = 10;
  if (![1, 2, 4, 12].includes(freq)) freq = 2;

  let price = q.price != null ? parseFloat(q.price) : null;
  let ytm = q.yield != null ? parseFloat(q.yield) : null;

  if (price != null && fin(price) && (ytm == null || !fin(ytm))) {
    ytm = bondYtm(price, coupon, years, freq, face);
  } else if (ytm != null && fin(ytm)) {
    price = bondPrice(ytm, coupon, years, freq, face);
  } else {
    // Default: par bond (price 100)
    price = 100;
    ytm = bondYtm(price, coupon, years, freq, face);
  }

  // Risk metrics
  const risk = durationAndConvexity(price, ytm, coupon, years, freq, face);
  const flows = cashFlows(ytm, coupon, years, freq, face);
  const scenarios = rateScenarios(price, ytm, coupon, years, freq, face);
  const currentYield = price > 0 ? (coupon / price) * 100 : 0;

  // Retrieve benchmark Treasury curve for G-spread comparison
  let benchTenor = "10Y";
  if (years <= 2) benchTenor = "2Y";
  else if (years <= 3) benchTenor = "3Y";
  else if (years <= 6) benchTenor = "5Y";
  else if (years <= 8) benchTenor = "7Y";
  else if (years <= 15) benchTenor = "10Y";
  else if (years <= 25) benchTenor = "20Y";
  else benchTenor = "30Y";

  let benchYield = null;
  let benchSpreadBp = null;
  let treasuryCurve = null;

  try {
    const curveData = await gc({ country: "US" }).catch(() => null);
    if (curveData?.curves?.[0]?.values) {
      treasuryCurve = curveData.curves[0].values;
      benchYield = treasuryCurve[benchTenor] ?? null;
      if (benchYield != null && fin(ytm)) {
        benchSpreadBp = round((ytm - benchYield) * 100, 1);
      }
    }
  } catch {
    // optional live curve failure fallback
  }

  return {
    instrument: {
      name: `${years}Y ${coupon}% Bond`,
      coupon: round(coupon, 3),
      years: round(years, 2),
      freq,
      face,
    },
    pricing: {
      cleanPrice: round(price, 3),
      dirtyPrice: round(price, 3), // assume on coupon date for standard YAS
      ytm: round(ytm, 3),
      currentYield: round(currentYield, 3),
    },
    risk: {
      ...risk,
      dv01Per100k: round(risk.dv01 * 1000, 2), // standard dealer convention ($ per $100k)
    },
    benchmark: {
      tenor: benchTenor,
      yield: benchYield != null ? round(benchYield, 3) : null,
      spreadBp: benchSpreadBp,
    },
    presets: PRESETS,
    scenarios,
    cashFlows: flows.slice(0, 12),
    totalPeriods: flows.length,
    source: "Amber Terminal fixed income pricer; US Treasury curve via Treasury.gov",
  };
}
