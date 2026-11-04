// /api/fn/srch : Fixed Income & Corporate Bond Search / Screener (SRCH).
// Mirrors Bloomberg Terminal's SRCH function for fixed income securities.
// Allows filtering across criteria: keyword, issuer, CUSIP, bond type, sector,
// rating grade, coupon min/max, maturity years min/max, yield min/max, spread min/max.
import { PRESETS, parseRating, bondPrice, bondYtm, interpolateTreasuryCurve } from "./yas.js";
import gc from "./gc.js";

const fin = Number.isFinite;
const round = (v, d = 3) => (fin(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

// Extended multi-sector universe of investment grade & high yield bonds + sovereign curves
export const BOND_UNIVERSE = [
  ...PRESETS,
  // Additional diversified corporate & financial issuers
  { id: "ORCL_2032", name: "Oracle Corp 3.95% 2032", type: "corp", issuer: "Oracle Corp.", cusip: "68389XBT8", sector: "Technology", rating: "BBB", ratingCode: 9, years: 7.5, coupon: 3.95, spreadBp: 155, freq: 2 },
  { id: "CSCO_2028", name: "Cisco Systems 5.25% 2028", type: "corp", issuer: "Cisco Systems Inc.", cusip: "17275RBK3", sector: "Technology", rating: "AA-", ratingCode: 4, years: 3.8, coupon: 5.25, spreadBp: 65, freq: 2 },
  { id: "IBM_2031",  name: "IBM Corp 4.50% 2031", type: "corp", issuer: "IBM Corp.", cusip: "459200KB2", sector: "Technology", rating: "A-", ratingCode: 7, years: 6.5, coupon: 4.50, spreadBp: 105, freq: 2 },
  { id: "C_2030",    name: "Citigroup Inc 4.412% 2030", type: "corp", issuer: "Citigroup Inc.", cusip: "172967ME3", sector: "Finance", rating: "BBB+", ratingCode: 8, years: 5.5, coupon: 4.412, spreadBp: 140, freq: 2 },
  { id: "MS_2032",   name: "Morgan Stanley 5.297% 2032", type: "corp", issuer: "Morgan Stanley", cusip: "6174468U8", sector: "Finance", rating: "A-", ratingCode: 7, years: 7.2, coupon: 5.297, spreadBp: 125, freq: 2 },
  { id: "WFC_2029",  name: "Wells Fargo 4.808% 2029", type: "corp", issuer: "Wells Fargo & Co.", cusip: "949746SL2", sector: "Finance", rating: "BBB+", ratingCode: 8, years: 4.5, coupon: 4.808, spreadBp: 130, freq: 2 },
  { id: "HD_2030",   name: "Home Depot 4.00% 2030", type: "corp", issuer: "Home Depot Inc.", cusip: "437076BY8", sector: "Consumer", rating: "A", ratingCode: 6, years: 5.5, coupon: 4.00, spreadBp: 85, freq: 2 },
  { id: "MCD_2028",  name: "McDonald's Corp 3.625% 2028", type: "corp", issuer: "McDonald's Corp.", cusip: "58013MFX2", sector: "Consumer", rating: "BBB+", ratingCode: 8, years: 3.5, coupon: 3.625, spreadBp: 95, freq: 2 },
  { id: "CVX_2031",  name: "Chevron Corp 2.978% 2031", type: "corp", issuer: "Chevron Corp.", cusip: "166764CY6", sector: "Energy", rating: "AA", ratingCode: 3, years: 6.5, coupon: 2.978, spreadBp: 60, freq: 2 },
  { id: "COP_2029",  name: "ConocoPhillips 4.30% 2029", type: "corp", issuer: "ConocoPhillips", cusip: "20826FAB3", sector: "Energy", rating: "A-", ratingCode: 7, years: 4.5, coupon: 4.30, spreadBp: 90, freq: 2 },
  { id: "PFE_2030",  name: "Pfizer Inc 4.45% 2030", type: "corp", issuer: "Pfizer Inc.", cusip: "717081FG2", sector: "Healthcare", rating: "A", ratingCode: 6, years: 5.5, coupon: 4.45, spreadBp: 95, freq: 2 },
  { id: "UNH_2032",  name: "UnitedHealth Group 4.20% 2032", type: "corp", issuer: "UnitedHealth Group", cusip: "91324PDT9", sector: "Healthcare", rating: "A+", ratingCode: 5, years: 7.5, coupon: 4.20, spreadBp: 80, freq: 2 },
  { id: "VZ_2030",   name: "Verizon Communications 4.329% 2030", type: "corp", issuer: "Verizon Communications", cusip: "92343VEJ7", sector: "Communications", rating: "BBB+", ratingCode: 8, years: 5.5, coupon: 4.329, spreadBp: 125, freq: 2 },
  { id: "T_2031",    name: "AT&T Inc 4.35% 2031", type: "corp", issuer: "AT&T Inc.", cusip: "00206RNL1", sector: "Communications", rating: "BBB", ratingCode: 9, years: 6.5, coupon: 4.35, spreadBp: 145, freq: 2 },
  { id: "CAT_2033",  name: "Caterpillar Inc 4.75% 2033", type: "corp", issuer: "Caterpillar Inc.", cusip: "149123CK4", sector: "Industrials", rating: "A", ratingCode: 6, years: 8.5, coupon: 4.75, spreadBp: 85, freq: 2 },
  { id: "HON_2029",  name: "Honeywell Intl 4.95% 2029", type: "corp", issuer: "Honeywell International", cusip: "438516CF5", sector: "Industrials", rating: "A", ratingCode: 6, years: 4.5, coupon: 4.95, spreadBp: 75, freq: 2 },
  { id: "OXY_2028",  name: "Occidental Petroleum 6.45% 2028", type: "corp", issuer: "Occidental Petroleum", cusip: "674599DT3", sector: "Energy", rating: "BB+", ratingCode: 11, years: 3.5, coupon: 6.45, spreadBp: 260, freq: 2 },
  { id: "UBER_2029", name: "Uber Technologies 6.25% 2029", type: "corp", issuer: "Uber Technologies", cusip: "90353TAR2", sector: "Technology", rating: "BB+", ratingCode: 11, years: 4.5, coupon: 6.25, spreadBp: 245, freq: 2 },
];

export default async function (q = {}) {
  // Retrieve Treasury curve for baseline pricing
  let treasuryCurve = null;
  try {
    const curveData = await gc({ country: "US" }).catch(() => null);
    if (curveData?.curves?.[0]?.values) {
      treasuryCurve = curveData.curves[0].values;
    }
  } catch {
    // curve failure fallback
  }

  // Pre-calculate full pricing metrics for universe
  const fullUniverse = BOND_UNIVERSE.map((bond) => {
    const interpTreasury = interpolateTreasuryCurve(bond.years, treasuryCurve || {});
    const rInfo = parseRating(bond.rating ?? (bond.type === "govt" ? 1 : 9));
    const spreadBp = bond.spreadBp ?? (bond.type === "govt" ? 0 : rInfo?.defaultSpreadBp ?? 150);
    const ytm = interpTreasury + spreadBp / 100;
    const cleanPx = bondPrice(ytm, bond.coupon, bond.years, bond.freq || 2, 100);

    return {
      ...bond,
      ratingGrade: rInfo?.grade ?? (bond.type === "govt" ? "Sovereign" : "Unrated"),
      ratingCode: bond.ratingCode || rInfo?.code || 9,
      interpolatedTreasuryYield: round(interpTreasury, 3),
      spreadBp: round(spreadBp, 1),
      ytm: round(ytm, 3),
      cleanPrice: round(cleanPx, 3),
      currentYield: cleanPx > 0 ? round((bond.coupon / cleanPx) * 100, 3) : null,
    };
  });

  // Extract query filters
  const keyword = q.q ? String(q.q).trim().toLowerCase() : null;
  const type = q.type ? String(q.type).trim().toLowerCase() : null;
  const sector = q.sector ? String(q.sector).trim().toLowerCase() : null;
  const ratingGrade = q.ratingGrade ? String(q.ratingGrade).trim().toLowerCase() : null;
  const minCoupon = fin(+q.couponMin) ? +q.couponMin : null;
  const maxCoupon = fin(+q.couponMax) ? +q.couponMax : null;
  const minYears = fin(+q.yearsMin) ? +q.yearsMin : null;
  const maxYears = fin(+q.yearsMax) ? +q.yearsMax : null;
  const minYield = fin(+q.yieldMin) ? +q.yieldMin : null;
  const maxYield = fin(+q.yieldMax) ? +q.yieldMax : null;
  const minSpread = fin(+q.spreadMin) ? +q.spreadMin : null;
  const maxSpread = fin(+q.spreadMax) ? +q.spreadMax : null;

  // Filter bonds
  let filtered = fullUniverse.filter((b) => {
    if (type && type !== "all" && b.type.toLowerCase() !== type) return false;
    if (sector && sector !== "all" && b.sector?.toLowerCase() !== sector) return false;
    if (ratingGrade && ratingGrade !== "all") {
      if (ratingGrade === "ig" && b.ratingGrade !== "Investment Grade") return false;
      if (ratingGrade === "hy" && b.ratingGrade !== "High Yield") return false;
      if (ratingGrade === "sov" && b.type !== "govt") return false;
    }
    if (keyword) {
      const match =
        b.name.toLowerCase().includes(keyword) ||
        b.issuer.toLowerCase().includes(keyword) ||
        (b.cusip && b.cusip.toLowerCase().includes(keyword)) ||
        (b.id && b.id.toLowerCase().includes(keyword));
      if (!match) return false;
    }
    if (minCoupon != null && b.coupon < minCoupon) return false;
    if (maxCoupon != null && b.coupon > maxCoupon) return false;
    if (minYears != null && b.years < minYears) return false;
    if (maxYears != null && b.years > maxYears) return false;
    if (minYield != null && b.ytm < minYield) return false;
    if (maxYield != null && b.ytm > maxYield) return false;
    if (minSpread != null && b.spreadBp < minSpread) return false;
    if (maxSpread != null && b.spreadBp > maxSpread) return false;
    return true;
  });

  // Sorting
  const sort = q.sort || "years";
  const dir = q.dir === "desc" ? -1 : 1;
  filtered.sort((a, b) => {
    let va = a[sort] ?? 0;
    let vb = b[sort] ?? 0;
    if (typeof va === "string") return dir * va.localeCompare(vb);
    return dir * (va - vb);
  });

  // Extract distinct sectors and rating grades for frontend filter dropdowns
  const sectors = [...new Set(fullUniverse.map((b) => b.sector).filter(Boolean))].sort();
  const issuers = [...new Set(fullUniverse.map((b) => b.issuer).filter(Boolean))].sort();

  return {
    total: filtered.length,
    universeSize: fullUniverse.length,
    rows: filtered,
    sectors,
    issuers,
    filters: {
      q: q.q || "",
      type: type || "all",
      sector: sector || "all",
      ratingGrade: ratingGrade || "all",
      couponMin: minCoupon,
      couponMax: maxCoupon,
      yearsMin: minYears,
      yearsMax: maxYears,
      yieldMin: minYield,
      yieldMax: maxYield,
      spreadMin: minSpread,
      spreadMax: maxSpread,
      sort,
      dir: q.dir || "asc",
    },
    source: "Amber Terminal fixed income & corporate bond screener (SRCH)",
  };
}
