// /api/fn/firv : Fixed Income Relative Value (FIRV) peer comparison analysis.
// Mirrors Bloomberg Terminal's FIRV function.
// Displays comparable bonds in the same sector / asset class as the selected issuer or bond,
// calculates benchmark Treasury spreads, relative duration, and curve fitting (spread vs duration)
// with cheap/rich valuation scoring.
import { BOND_UNIVERSE } from "./srch.js";
import { findBondByCusip, parseRating, bondPrice, interpolateTreasuryCurve } from "./yas.js";
import gc from "./gc.js";

const fin = Number.isFinite;
const round = (v, d = 3) => (fin(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

export default async function (q = {}) {
  // Identify the target bond / issuer
  let targetBond = null;
  const targetKey = q.ticker || q.cusip || q.id || q.bond || "AAPL_2030";

  // Match target by CUSIP or ID
  targetBond = findBondByCusip(targetKey) || BOND_UNIVERSE.find((b) => b.id.toUpperCase() === String(targetKey).toUpperCase());

  // Fallback to Apple 2030 if target not found
  if (!targetBond) {
    targetBond = BOND_UNIVERSE.find((b) => b.id === "AAPL_2030") || BOND_UNIVERSE[4];
  }

  const targetSector = targetBond.sector || "Technology";
  const targetType = targetBond.type || "corp";

  // Fetch Treasury curve for benchmark comparison
  let treasuryCurve = null;
  try {
    const curveData = await gc({ country: "US" }).catch(() => null);
    if (curveData?.curves?.[0]?.values) {
      treasuryCurve = curveData.curves[0].values;
    }
  } catch {
    // curve failure fallback
  }

  // Find comparable peers in the same sector (or sovereign peer group if govt)
  let peers = BOND_UNIVERSE.filter((b) => {
    if (targetType === "govt") return b.type === "govt";
    return b.type === "corp" && (b.sector === targetSector || b.issuer === targetBond.issuer);
  });

  // If sector has very few peers, include other representative corporate benchmarks
  if (peers.length < 3 && targetType === "corp") {
    const extra = BOND_UNIVERSE.filter((b) => b.type === "corp" && !peers.some((p) => p.id === b.id)).slice(0, 5);
    peers = [...peers, ...extra];
  }

  // Calculate market metrics for each peer bond
  const enrichedPeers = peers.map((p) => {
    const interpTreasury = interpolateTreasuryCurve(p.years, treasuryCurve || {});
    const rInfo = parseRating(p.rating ?? (p.type === "govt" ? 1 : 9));
    const spreadBp = p.spreadBp ?? (p.type === "govt" ? 0 : rInfo?.defaultSpreadBp ?? 150);
    const ytm = interpTreasury + spreadBp / 100;
    const cleanPx = bondPrice(ytm, p.coupon, p.years, p.freq || 2, 100);

    // Approximate duration
    const approxDur = p.years / (1 + (ytm / 100) / 2);

    return {
      ...p,
      isTarget: p.id === targetBond.id || p.cusip === targetBond.cusip,
      rating: p.rating || (p.type === "govt" ? "AAA" : "BBB"),
      ratingGrade: rInfo?.grade ?? (p.type === "govt" ? "Sovereign" : "Unrated"),
      interpolatedTreasuryYield: round(interpTreasury, 3),
      spreadBp: round(spreadBp, 1),
      ytm: round(ytm, 3),
      cleanPrice: round(cleanPx, 3),
      approxDuration: round(approxDur, 2),
    };
  });

  // Perform Linear Regression of Spread vs Duration (Sector Spread Curve)
  // spreadBp = alpha + beta * duration
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = enrichedPeers.length;

  for (const b of enrichedPeers) {
    sumX += b.approxDuration;
    sumY += b.spreadBp;
    sumXY += b.approxDuration * b.spreadBp;
    sumXX += b.approxDuration * b.approxDuration;
  }

  const slope = n > 1 && (n * sumXX - sumX * sumX) !== 0
    ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    : 0;
  const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

  // Calculate relative value (Cheap / Rich) score:
  // Fitted Spread = intercept + slope * duration
  // Residual = actual spread - fitted spread
  // If Residual > +10 bp => CHEAP (wider spread / higher yield than model curve)
  // If Residual < -10 bp => RICH (tighter spread / lower yield than model curve)
  // Else => FAIR
  const rows = enrichedPeers.map((b) => {
    const fittedSpread = round(intercept + slope * b.approxDuration, 1);
    const residualBp = round(b.spreadBp - fittedSpread, 1);
    let valClass = "fair";
    let valLabel = "FAIR";

    if (residualBp >= 12) {
      valClass = "cheap";
      valLabel = `CHEAP (+${residualBp} bp)`;
    } else if (residualBp <= -12) {
      valClass = "rich";
      valLabel = `RICH (${residualBp} bp)`;
    }

    return {
      ...b,
      fittedSpread,
      residualBp,
      relativeValue: valLabel,
      valClass,
    };
  });

  // Sort by maturity / duration
  rows.sort((a, b) => a.years - b.years);

  return {
    target: {
      id: targetBond.id,
      name: targetBond.name,
      issuer: targetBond.issuer,
      cusip: targetBond.cusip,
      sector: targetSector,
      type: targetType,
    },
    sector: targetSector,
    peerCount: rows.length,
    curveFit: {
      slope: round(slope, 2),
      intercept: round(intercept, 1),
      equation: `Spread (bp) = ${round(intercept, 1)} + ${round(slope, 2)} × Duration`,
    },
    rows,
    source: "Amber Terminal fixed income relative value pricer (FIRV)",
  };
}
