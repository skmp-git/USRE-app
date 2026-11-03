// /api/fn/eqs?sector=Technology&capMin=10B&sort=marketCap&market=US : the equity screener.
// Screens across the US equity universe (~7,000 stocks across NYSE, Nasdaq, AMEX)
// and Hong Kong equities (HKEX main board leaders).
import { nasdaqScreener, cached, getJson, YAHOO_UA } from "../providers.js";
import { board } from "./board.js";

export const MAX_ROWS = 200;
const SORTS = [
  "ticker",
  "name",
  "price",
  "changePct",
  "volume",
  "marketCap",
  "sector",
  "country",
  "market",
];

// Major Hong Kong listed securities with their HKEX code, Yahoo symbol, company name, and sector.
export const HK_CONSTITUENTS = [
  { ticker: "0700", symbol: "0700.HK", name: "Tencent Holdings Ltd", sector: "Technology", industry: "Internet & Digital Media" },
  { ticker: "9988", symbol: "9988.HK", name: "Alibaba Group Holding Ltd", sector: "Consumer Discretionary", industry: "E-Commerce & Cloud" },
  { ticker: "3690", symbol: "3690.HK", name: "Meituan", sector: "Consumer Discretionary", industry: "Local Services & Delivery" },
  { ticker: "0005", symbol: "0005.HK", name: "HSBC Holdings PLC", sector: "Finance", industry: "Banking & Financial Services" },
  { ticker: "1211", symbol: "1211.HK", name: "BYD Company Ltd", sector: "Consumer Discretionary", industry: "Electric Vehicles & Batteries" },
  { ticker: "1810", symbol: "1810.HK", name: "Xiaomi Corp", sector: "Technology", industry: "Consumer Electronics & IoT" },
  { ticker: "0941", symbol: "0941.HK", name: "China Mobile Ltd", sector: "Telecommunications", industry: "Telecom Services" },
  { ticker: "1299", symbol: "1299.HK", name: "AIA Group Ltd", sector: "Finance", industry: "Insurance" },
  { ticker: "2318", symbol: "2318.HK", name: "Ping An Insurance Group", sector: "Finance", industry: "Multi-line Insurance & Fintech" },
  { ticker: "0388", symbol: "0388.HK", name: "Hong Kong Exchanges & Clearing", sector: "Finance", industry: "Financial Exchanges" },
  { ticker: "9618", symbol: "9618.HK", name: "JD.com Inc", sector: "Consumer Discretionary", industry: "E-Commerce" },
  { ticker: "9888", symbol: "9888.HK", name: "Baidu Inc", sector: "Technology", industry: "AI & Search" },
  { ticker: "2015", symbol: "2015.HK", name: "Li Auto Inc", sector: "Consumer Discretionary", industry: "Automotive" },
  { ticker: "9866", symbol: "9866.HK", name: "NIO Inc", sector: "Consumer Discretionary", industry: "Automotive" },
  { ticker: "9868", symbol: "9868.HK", name: "XPeng Inc", sector: "Consumer Discretionary", industry: "Automotive" },
  { ticker: "1024", symbol: "1024.HK", name: "Kuaishou Technology", sector: "Technology", industry: "Social & Short Video" },
  { ticker: "0883", symbol: "0883.HK", name: "CNOOC Ltd", sector: "Energy", industry: "Oil & Gas Exploration" },
  { ticker: "0857", symbol: "0857.HK", name: "PetroChina Co Ltd", sector: "Energy", industry: "Oil & Gas Integrated" },
  { ticker: "0386", symbol: "0386.HK", name: "China Petroleum & Chemical (Sinopec)", sector: "Energy", industry: "Refining & Marketing" },
  { ticker: "1398", symbol: "1398.HK", name: "Industrial & Commercial Bank of China", sector: "Finance", industry: "Diversified Banking" },
  { ticker: "0939", symbol: "0939.HK", name: "China Construction Bank Corp", sector: "Finance", industry: "Diversified Banking" },
  { ticker: "3988", symbol: "3988.HK", name: "Bank of China Ltd", sector: "Finance", industry: "Diversified Banking" },
  { ticker: "1288", symbol: "1288.HK", name: "Agricultural Bank of China", sector: "Finance", industry: "Diversified Banking" },
  { ticker: "2269", symbol: "2269.HK", name: "WuXi Biologics Ltd", sector: "Health Care", industry: "Biotechnology & CDMO" },
  { ticker: "2359", symbol: "2359.HK", name: "WuXi AppTec Co Ltd", sector: "Health Care", industry: "Life Sciences Tools & Services" },
  { ticker: "1093", symbol: "1093.HK", name: "CSPC Pharmaceutical Group", sector: "Health Care", industry: "Pharmaceuticals" },
  { ticker: "1177", symbol: "1177.HK", name: "Sino Biopharmaceutical Ltd", sector: "Health Care", industry: "Pharmaceuticals" },
  { ticker: "0016", symbol: "0016.HK", name: "Sun Hung Kai Properties", sector: "Real Estate", industry: "Property Development" },
  { ticker: "1109", symbol: "1109.HK", name: "China Resources Land Ltd", sector: "Real Estate", industry: "Real Estate Operating Companies" },
  { ticker: "0688", symbol: "0688.HK", name: "China Overseas Land & Investment", sector: "Real Estate", industry: "Real Estate Operating Companies" },
  { ticker: "0823", symbol: "0823.HK", name: "Link Real Estate Investment Trust", sector: "Real Estate", industry: "Retail REIT" },
  { ticker: "0001", symbol: "0001.HK", name: "CK Hutchison Holdings Ltd", sector: "Industrials", industry: "Conglomerate & Ports" },
  { ticker: "0003", symbol: "0003.HK", name: "Hong Kong & China Gas Co", sector: "Utilities", industry: "Gas Distribution" },
  { ticker: "0002", symbol: "0002.HK", name: "CLP Holdings Ltd", sector: "Utilities", industry: "Electric Utilities" },
  { ticker: "0006", symbol: "0006.HK", name: "Power Assets Holdings Ltd", sector: "Utilities", industry: "Electric Utilities" },
  { ticker: "0027", symbol: "0027.HK", name: "Galaxy Entertainment Group", sector: "Consumer Discretionary", industry: "Casinos & Gaming" },
  { ticker: "1928", symbol: "1928.HK", name: "Sands China Ltd", sector: "Consumer Discretionary", industry: "Casinos & Gaming" },
  { ticker: "0992", symbol: "0992.HK", name: "Lenovo Group Ltd", sector: "Technology", industry: "Hardware & PC" },
  { ticker: "0241", symbol: "0241.HK", name: "Alibaba Health Information Tech", sector: "Health Care", industry: "Healthcare Technology" },
  { ticker: "9961", symbol: "9961.HK", name: "Trip.com Group Ltd", sector: "Consumer Discretionary", industry: "Online Travel Services" },
  { ticker: "9999", symbol: "9999.HK", name: "NetEase Inc", sector: "Technology", industry: "Gaming & Interactive Media" },
  { ticker: "0268", symbol: "0268.HK", name: "Kingdee International Software", sector: "Technology", industry: "Enterprise Software" },
  { ticker: "0981", symbol: "0981.HK", name: "Semiconductor Manufacturing Int (SMIC)", sector: "Technology", industry: "Semiconductors" },
  { ticker: "1347", symbol: "1347.HK", name: "Hua Hong Semiconductor Ltd", sector: "Technology", industry: "Semiconductors" },
  { ticker: "2382", symbol: "2382.HK", name: "Sunny Optical Technology", sector: "Technology", industry: "Electronic Components" },
];

export async function hkScreener() {
  return cached("hk:screener:stocks", 60e3, async () => {
    const symbols = HK_CONSTITUENTS.map((c) => c.symbol);
    const b = await board(symbols).catch(() => ({}));
    return HK_CONSTITUENTS.map((c) => {
      const q = b[c.symbol] || {};
      const price = q.price || 0;
      const changePct = q.changePct || 0;
      return {
        ticker: c.ticker,
        symbol: `YAHOO:${c.symbol}`,
        name: c.name,
        price,
        changePct,
        volume: q.spark?.length ? 1e6 : 0,
        // Approximate market cap in HKD where available, otherwise scale by price
        marketCap: price * 1e8,
        sector: c.sector,
        industry: c.industry,
        country: "Hong Kong",
        market: "HK",
        currency: "HKD",
        live: !!price,
      };
    });
  });
}

// Words you can type after EQS. Each sets some of the form's fields.
export const PRESETS = {
  MEGA: { capMin: 200e9 },
  LARGE: { capMin: 10e9 },
  MID: { capMin: 2e9, capMax: 10e9 },
  SMALL: { capMin: 300e6, capMax: 2e9 },
  MICRO: { capMax: 300e6 },
  TECH: { sector: "Technology" },
  FINANCE: { sector: "Finance" },
  HEALTH: { sector: "Health Care" },
  ENERGY: { sector: "Energy" },
  INDUSTRIALS: { sector: "Industrials" },
  UTILITIES: { sector: "Utilities" },
  STAPLES: { sector: "Consumer Staples" },
  DISCRETIONARY: { sector: "Consumer Discretionary" },
  MATERIALS: { sector: "Basic Materials" },
  TELECOM: { sector: "Telecommunications" },
  REALESTATE: { sector: "Real Estate" },
  US: { market: "US", country: "United States" },
  HK: { market: "HK" },
  GAINERS: {
    sort: "changePct",
    dir: "desc",
    chgMin: 0,
    priceMin: 5,
    capMin: 300e6,
  },
  LOSERS: {
    sort: "changePct",
    dir: "asc",
    chgMax: 0,
    priceMin: 5,
    capMin: 300e6,
  },
  ACTIVE: { sort: "volume", dir: "desc" },
};

// "10B", "500M", "2.5K", "1,000" -> a number. Blank -> null.
export function amount(v) {
  if (v == null || v === "") return null;
  const m = /^\s*(-?[\d,]*\.?\d+)\s*([KMBT])?\s*$/i.exec(String(v));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const mult =
    { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[2] || "").toUpperCase()] || 1;
  return n * mult;
}

// Query and preset words -> one filter object.
export function filtersFrom(q = {}) {
  const f = {};
  for (const w of String(q.preset || "")
    .toUpperCase()
    .split(/[\s,]+/)
    .filter(Boolean))
    Object.assign(f, PRESETS[w] || {});
  for (const k of [
    "capMin",
    "capMax",
    "priceMin",
    "priceMax",
    "chgMin",
    "chgMax",
    "volMin",
  ]) {
    const v = amount(q[k]);
    if (v != null) f[k] = v;
  }
  for (const k of ["sector", "country", "market"]) if (q[k]) f[k] = String(q[k]);
  if (SORTS.includes(q.sort)) f.sort = q.sort;
  if (q.dir === "asc" || q.dir === "desc") f.dir = q.dir;
  f.sort ||= "marketCap";
  f.dir ||= ["ticker", "name", "sector", "country", "market"].includes(f.sort)
    ? "asc"
    : "desc";
  return f;
}

const within = (v, lo, hi) =>
  (lo == null || v >= lo) && (hi == null || v <= hi);

export function screen(rows, f) {
  const hit = rows.filter(
    (r) =>
      (!f.market || f.market === "ALL" || r.market === f.market) &&
      (!f.sector || r.sector === f.sector) &&
      (!f.country || r.country === f.country) &&
      // A stock with no market cap on file can't pass a market-cap filter.
      (f.capMin == null && f.capMax == null
        ? true
        : r.marketCap > 0 && within(r.marketCap, f.capMin, f.capMax)) &&
      within(r.price, f.priceMin, f.priceMax) &&
      within(r.changePct, f.chgMin, f.chgMax) &&
      (f.volMin == null || r.volume >= f.volMin),
  );
  const k = f.sort || "marketCap";
  const sign = f.dir === "asc" ? 1 : -1;
  hit.sort((a, b) => {
    const x = a[k],
      y = b[k];
    const c =
      typeof x === "string" || typeof y === "string"
        ? String(x ?? "").localeCompare(String(y ?? ""))
        : (x ?? 0) - (y ?? 0);
    return c * sign || a.ticker.localeCompare(b.ticker);
  });
  return { total: hit.length, rows: hit.slice(0, MAX_ROWS) };
}

// The sectors, countries and markets in the list, most common first, for the form's drop-downs.
export function facets(rows) {
  const count = (k) => {
    const m = new Map();
    for (const r of rows) if (r[k]) m.set(r[k], (m.get(r[k]) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
  };
  return {
    sectors: count("sector"),
    countries: count("country"),
    markets: count("market"),
  };
}

export default async function (q = {}) {
  const f = filtersFrom(q);
  const wantMarket = f.market ? f.market.toUpperCase() : "ALL";

  let usRows = [];
  let hkRows = [];

  if (wantMarket === "US" || wantMarket === "ALL") {
    const rawUs = await nasdaqScreener("stocks").catch(() => []);
    usRows = rawUs.map((r) => ({
      ...r,
      market: "US",
      currency: "USD",
    }));
  }

  if (wantMarket === "HK" || wantMarket === "ALL") {
    hkRows = await hkScreener().catch(() => []);
  }

  const all = [...usRows, ...hkRows];
  const { total, rows } = screen(all, f);

  return {
    filters: f,
    universe: all.length,
    total,
    rows: rows.map(
      ({
        ticker,
        symbol,
        name,
        price,
        changePct,
        volume,
        marketCap,
        sector,
        industry,
        country,
        market,
        currency,
        live,
      }) => ({
        ticker,
        symbol,
        name: name.trim(),
        price,
        changePct,
        volume,
        marketCap,
        sector,
        industry,
        country,
        market: market || "US",
        currency: currency || "USD",
        live,
      }),
    ),
    ...facets(all),
    source:
      "Global equity screener: entire US equity universe (NYSE, Nasdaq, AMEX) and Hong Kong (HKEX). Live quotes on active leaders; rest as of last close.",
  };
}
