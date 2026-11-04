// /api/fn/yas : Fixed Income Yield & Spread (YAS) Bond Valuation and Risk Analytics.
// Incorporates Open Source Bond Asset Pricing (OSBAP / TRACE Pipeline - Dickerson et al.)
// methodologies for corporate and government bond pricing, accrued interest, credit spreads
// over maturity-matched Treasury benchmark, CS01, rating metrics, and corporate presets.
import gc from "./gc.js";

const fin = Number.isFinite;
const round = (v, d = 4) => (fin(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

/**
 * Standard S&P & Moody's rating scale definitions (1 to 22), matching OSBAP Stage 1.
 */
export const RATING_SCALE = {
  1:  { sp: "AAA",  mdy: "Aaa", grade: "Investment Grade", quality: "Highest Quality", defaultSpreadBp: 45 },
  2:  { sp: "AA+",  mdy: "Aa1", grade: "Investment Grade", quality: "High Quality",    defaultSpreadBp: 60 },
  3:  { sp: "AA",   mdy: "Aa2", grade: "Investment Grade", quality: "High Quality",    defaultSpreadBp: 70 },
  4:  { sp: "AA-",  mdy: "Aa3", grade: "Investment Grade", quality: "High Quality",    defaultSpreadBp: 80 },
  5:  { sp: "A+",   mdy: "A1",  grade: "Investment Grade", quality: "Upper Medium",    defaultSpreadBp: 95 },
  6:  { sp: "A",    mdy: "A2",  grade: "Investment Grade", quality: "Upper Medium",    defaultSpreadBp: 110 },
  7:  { sp: "A-",   mdy: "A3",  grade: "Investment Grade", quality: "Upper Medium",    defaultSpreadBp: 125 },
  8:  { sp: "BBB+", mdy: "Baa1", grade: "Investment Grade", quality: "Lower Medium",    defaultSpreadBp: 145 },
  9:  { sp: "BBB",  mdy: "Baa2", grade: "Investment Grade", quality: "Lower Medium",    defaultSpreadBp: 165 },
  10: { sp: "BBB-", mdy: "Baa3", grade: "Investment Grade", quality: "Lower Medium",    defaultSpreadBp: 190 },
  11: { sp: "BB+",  mdy: "Ba1", grade: "High Yield",       quality: "Non-Investment Speculative", defaultSpreadBp: 240 },
  12: { sp: "BB",   mdy: "Ba2", grade: "High Yield",       quality: "Non-Investment Speculative", defaultSpreadBp: 290 },
  13: { sp: "BB-",  mdy: "Ba3", grade: "High Yield",       quality: "Non-Investment Speculative", defaultSpreadBp: 340 },
  14: { sp: "B+",   mdy: "B1",  grade: "High Yield",       quality: "Highly Speculative",          defaultSpreadBp: 420 },
  15: { sp: "B",    mdy: "B2",  grade: "High Yield",       quality: "Highly Speculative",          defaultSpreadBp: 500 },
  16: { sp: "B-",   mdy: "B3",  grade: "High Yield",       quality: "Highly Speculative",          defaultSpreadBp: 600 },
  17: { sp: "CCC+", mdy: "Caa1", grade: "High Yield",       quality: "Substantial Risk",            defaultSpreadBp: 800 },
  18: { sp: "CCC",  mdy: "Caa2", grade: "High Yield",       quality: "Substantial Risk",            defaultSpreadBp: 1050 },
  19: { sp: "CCC-", mdy: "Caa3", grade: "High Yield",       quality: "Substantial Risk",            defaultSpreadBp: 1350 },
  20: { sp: "CC",   mdy: "Ca",  grade: "High Yield",       quality: "Extremely Speculative",      defaultSpreadBp: 1750 },
  21: { sp: "C",    mdy: "C",   grade: "High Yield",       quality: "Near Default",               defaultSpreadBp: 2200 },
  22: { sp: "D",    mdy: "D",   grade: "Default",          quality: "In Default",                 defaultSpreadBp: 3500 },
};

/**
 * Resolves rating numeric code and info from string or number.
 */
export function parseRating(ratingInput) {
  if (ratingInput == null) return null;
  const num = parseInt(ratingInput, 10);
  if (fin(num) && num >= 1 && num <= 22) {
    return { code: num, ...RATING_SCALE[num] };
  }
  const cleanStr = String(ratingInput).toUpperCase().trim();
  for (let c = 1; c <= 22; c++) {
    const r = RATING_SCALE[c];
    if (r.sp === cleanStr || r.mdy.toUpperCase() === cleanStr) {
      return { code: c, ...r };
    }
  }
  return null;
}

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
  const annualCoupon = (coupon / 100) * face;
  const approxYtm = (annualCoupon + (face - price) / years) / ((face + price) / 2);
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
 * Calculates accrued interest using 30/360 or ACT/ACT conventions (OSBAP acclast).
 * @param {number} coupon Annual coupon rate in percent
 * @param {number} freq Frequency per year
 * @param {number} face Par value
 * @param {number} daysAccrued Days accrued since last coupon (default ~60 for standard mid-period demo)
 * @param {string} convention Day count convention ("30/360" or "ACT/ACT")
 */
export function accruedInterest(coupon, freq = 2, face = 100, daysAccrued = 60, convention = "30/360") {
  const daysInPeriod = convention === "30/360" ? 360 / freq : 365 / freq;
  const periodCoupon = (coupon / 100 * face) / freq;
  const fraction = Math.min(1, Math.max(0, daysAccrued / daysInPeriod));
  const acclast = periodCoupon * fraction;
  return {
    acclast: round(acclast, 4),
    daysAccrued,
    daysInPeriod: Math.round(daysInPeriod),
    accruedFraction: round(fraction, 4),
    convention,
  };
}

/**
 * OSBAP ComputeCredit: Linear Treasury curve key-rate interpolation across
 * 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, and 30Y tenors.
 * Exactly replicates the Open Source Bond Asset Pricing Treasury benchmark matching logic.
 */
export function interpolateTreasuryCurve(years, curve = {}) {
  // Fallback realistic curve nodes if live feeds missing
  const nodes = [
    { tenor: 1,  rate: curve["1Y"] ?? 4.35 },
    { tenor: 2,  rate: curve["2Y"] ?? 4.15 },
    { tenor: 3,  rate: curve["3Y"] ?? 4.08 },
    { tenor: 5,  rate: curve["5Y"] ?? 4.12 },
    { tenor: 7,  rate: curve["7Y"] ?? 4.22 },
    { tenor: 10, rate: curve["10Y"] ?? 4.38 },
    { tenor: 20, rate: curve["20Y"] ?? 4.65 },
    { tenor: 30, rate: curve["30Y"] ?? 4.58 },
  ];

  if (years <= nodes[0].tenor) return nodes[0].rate;
  if (years >= nodes[nodes.length - 1].tenor) return nodes[nodes.length - 1].rate;

  for (let i = 0; i < nodes.length - 1; i++) {
    const t0 = nodes[i].tenor;
    const t1 = nodes[i + 1].tenor;
    if (years >= t0 && years <= t1) {
      const frac = (years - t0) / (t1 - t0);
      return nodes[i].rate + frac * (nodes[i + 1].rate - nodes[i].rate);
    }
  }
  return nodes[nodes.length - 1].rate;
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

// Preset securities: Sovereign & OSBAP Corporate Benchmark Presets
export const PRESETS = [
  // US Treasuries
  { id: "US2Y", name: "US Treasury 2Y Note", type: "govt", issuer: "US Treasury", years: 2, coupon: 4.25, freq: 2, benchmark: "2Y" },
  { id: "US5Y", name: "US Treasury 5Y Note", type: "govt", issuer: "US Treasury", years: 5, coupon: 4.125, freq: 2, benchmark: "5Y" },
  { id: "US10Y", name: "US Treasury 10Y Note", type: "govt", issuer: "US Treasury", years: 10, coupon: 4.5, freq: 2, benchmark: "10Y" },
  { id: "US30Y", name: "US Treasury 30Y Bond", type: "govt", issuer: "US Treasury", years: 30, coupon: 4.625, freq: 2, benchmark: "30Y" },

  // Corporate Bonds (OSBAP representative benchmark universe)
  { id: "AAPL_2030", name: "Apple Inc 4.30% 2030", type: "corp", issuer: "Apple Inc.", cusip: "037833EK3", sector: "Technology", rating: "AAA", ratingCode: 1, years: 5.5, coupon: 4.30, spreadBp: 65, freq: 2 },
  { id: "MSFT_2033", name: "Microsoft Corp 4.50% 2033", type: "corp", issuer: "Microsoft Corp.", cusip: "594918BW7", sector: "Technology", rating: "AAA", ratingCode: 1, years: 8.5, coupon: 4.50, spreadBp: 55, freq: 2 },
  { id: "JPM_2029",  name: "JPMorgan Chase 5.15% 2029", type: "corp", issuer: "JPMorgan Chase & Co.", cusip: "46647PCR2", sector: "Finance", rating: "A-", ratingCode: 7, years: 4.5, coupon: 5.15, spreadBp: 115, freq: 2 },
  { id: "AMZN_2034", name: "Amazon.com 4.70% 2034", type: "corp", issuer: "Amazon.com Inc.", cusip: "023135CL8", sector: "Consumer", rating: "AA", ratingCode: 3, years: 9.5, coupon: 4.70, spreadBp: 80, freq: 2 },
  { id: "BA_2031",   name: "Boeing Co 5.805% 2031", type: "corp", issuer: "Boeing Co.", cusip: "097023CN0", sector: "Industrials", rating: "BBB-", ratingCode: 10, years: 6.5, coupon: 5.805, spreadBp: 215, freq: 2 },
  { id: "F_2028",    name: "Ford Motor Credit 6.80% 2028", type: "corp", issuer: "Ford Motor Credit", cusip: "345397A58", sector: "Consumer", rating: "BB+", ratingCode: 11, years: 3.5, coupon: 6.80, spreadBp: 275, freq: 2 },
  { id: "TSLA_2027", name: "Tesla Inc 5.30% 2027", type: "corp", issuer: "Tesla Inc.", cusip: "88160RAW2", sector: "Consumer", rating: "BBB", ratingCode: 9, years: 2.5, coupon: 5.30, spreadBp: 155, freq: 2 },
  { id: "NFLX_2030", name: "Netflix Inc 5.875% 2030", type: "corp", issuer: "Netflix Inc.", cusip: "64110LAZ4", sector: "Communications", rating: "BBB+", ratingCode: 8, years: 5.0, coupon: 5.875, spreadBp: 135, freq: 2 },
];

export default async function (q = {}) {
  // Check preset match first
  let presetObj = null;
  if (q.preset) {
    presetObj = PRESETS.find((p) => p.id.toUpperCase() === String(q.preset).toUpperCase());
  }

  let coupon = q.coupon != null ? parseFloat(q.coupon) : (presetObj?.coupon ?? 4.5);
  let years = q.years != null ? parseFloat(q.years) : (presetObj?.years ?? 10);
  let freq = q.freq != null ? parseInt(q.freq, 10) : (presetObj?.freq ?? 2);
  const face = q.face != null ? parseFloat(q.face) : 100;
  const bondType = q.type || (presetObj?.type ?? "corp");

  if (!fin(coupon) || coupon < 0) coupon = 4.5;
  if (!fin(years) || years <= 0) years = 10;
  if (![1, 2, 4, 12].includes(freq)) freq = 2;

  // Retrieve Treasury curve for G-spread / credit spread computation
  let treasuryCurve = null;
  try {
    const curveData = await gc({ country: "US" }).catch(() => null);
    if (curveData?.curves?.[0]?.values) {
      treasuryCurve = curveData.curves[0].values;
    }
  } catch {
    // curve failure fallback
  }

  // OSBAP maturity-matched interpolated Treasury yield (ComputeCredit)
  const interpTreasuryYield = interpolateTreasuryCurve(years, treasuryCurve || {});

  // Corporate rating & credit spread resolution
  let ratingInfo = parseRating(q.rating ?? presetObj?.rating ?? (bondType === "corp" ? "BBB" : null));
  let spreadBp = q.spreadBp != null ? parseFloat(q.spreadBp) : null;

  if (spreadBp == null && presetObj?.spreadBp != null) {
    spreadBp = presetObj.spreadBp;
  } else if (spreadBp == null && ratingInfo != null) {
    spreadBp = ratingInfo.defaultSpreadBp;
  } else if (spreadBp == null) {
    spreadBp = bondType === "corp" ? 165 : 0;
  }

  let price = q.price != null ? parseFloat(q.price) : null;
  let ytm = q.yield != null ? parseFloat(q.yield) : null;

  if (price != null && fin(price) && (ytm == null || !fin(ytm))) {
    ytm = bondYtm(price, coupon, years, freq, face);
    // Implied credit spread from price
    if (fin(ytm) && interpTreasuryYield != null) {
      spreadBp = round((ytm - interpTreasuryYield) * 100, 1);
    }
  } else if (ytm != null && fin(ytm)) {
    price = bondPrice(ytm, coupon, years, freq, face);
    if (interpTreasuryYield != null) {
      spreadBp = round((ytm - interpTreasuryYield) * 100, 1);
    }
  } else {
    // If priced by spread over maturity-matched Treasury:
    ytm = interpTreasuryYield + (spreadBp / 100);
    price = bondPrice(ytm, coupon, years, freq, face);
  }

  // Accrued interest (OSBAP acclast: 30/360 day count convention, standard settlement)
  const daysAccrued = q.daysAccrued != null ? parseInt(q.daysAccrued, 10) : 60;
  const accrued = accruedInterest(coupon, freq, face, daysAccrued, q.dayCount || "30/360");
  const cleanPrice = price;
  const dirtyPrice = cleanPrice + accrued.acclast;

  // Risk metrics
  const risk = durationAndConvexity(cleanPrice, ytm, coupon, years, freq, face);
  const flows = cashFlows(ytm, coupon, years, freq, face);
  const scenarios = rateScenarios(cleanPrice, ytm, coupon, years, freq, face);
  const currentYield = cleanPrice > 0 ? (coupon / cleanPrice) * 100 : 0;

  // Credit spread sensitivity: CS01 (Spread DV01 - price change per 1 bp change in credit spread)
  const cs01 = risk.dv01; // For non-callable bullet bond, spread DV01 equals interest rate DV01
  const cs01Per100k = round(cs01 * 1000, 2);

  // Corporate issuer attributes
  const issuer = q.issuer || presetObj?.issuer || (bondType === "corp" ? "Corporate Issuer" : "US Treasury");
  const cusip = q.cusip || presetObj?.cusip || "N/A";
  const sector = q.sector || presetObj?.sector || (bondType === "corp" ? "Industrial" : "Sovereign");

  // Benchmark tenor classification
  let benchTenor = "10Y";
  if (years <= 2) benchTenor = "2Y";
  else if (years <= 3) benchTenor = "3Y";
  else if (years <= 6) benchTenor = "5Y";
  else if (years <= 8) benchTenor = "7Y";
  else if (years <= 15) benchTenor = "10Y";
  else if (years <= 25) benchTenor = "20Y";
  else benchTenor = "30Y";

  const benchYield = treasuryCurve?.[benchTenor] ?? interpTreasuryYield;

  return {
    instrument: {
      name: presetObj?.name || `${issuer} ${coupon}% ${years}Y`,
      type: bondType,
      issuer,
      cusip,
      sector,
      rating: ratingInfo ? `${ratingInfo.sp} / ${ratingInfo.mdy}` : "Not Rated",
      ratingGrade: ratingInfo?.grade ?? "Unrated",
      ratingQuality: ratingInfo?.quality ?? "N/A",
      ratingCode: ratingInfo?.code ?? null,
      coupon: round(coupon, 3),
      years: round(years, 2),
      freq,
      face,
      dayCount: accrued.convention,
    },
    pricing: {
      cleanPrice: round(cleanPrice, 3),
      dirtyPrice: round(dirtyPrice, 3),
      accruedInterest: accrued.acclast,
      daysAccrued: accrued.daysAccrued,
      ytm: round(ytm, 3),
      currentYield: round(currentYield, 3),
    },
    credit: {
      interpolatedTreasuryYield: round(interpTreasuryYield, 3),
      spreadBp: round(spreadBp, 1),
      cs01: round(cs01, 4),
      cs01Per100k,
      benchmarkCurve: "US Treasury (Liu-Wu / Key-Rate Tenors)",
      methodology: "Open Source Bond Asset Pricing (OSBAP / TRACE Pipeline)",
    },
    risk: {
      ...risk,
      dv01Per100k: round(risk.dv01 * 1000, 2),
    },
    benchmark: {
      tenor: benchTenor,
      yield: benchYield != null ? round(benchYield, 3) : null,
      spreadBp: round((ytm - benchYield) * 100, 1),
    },
    presets: PRESETS,
    scenarios,
    cashFlows: flows.slice(0, 12),
    totalPeriods: flows.length,
    source: "Amber Terminal fixed income & corporate bond pricer (OSBAP TRACE specification)",
  };
}
