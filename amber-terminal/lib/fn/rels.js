// /api/fn/rels?symbol=AAPL : Related Securities (RELS)
// Shows the capital structure and related securities of a company:
// 1. Equity classes (Common stock, ADRs, dual-class shares)
// 2. Debt & Fixed income issues (Senior unsecured notes, bonds, debentures, commercial paper)
// 3. Derivatives & options contracts
// 4. Competitor & Sector peer securities
import { BOND_UNIVERSE } from './srch.js';
import { cached } from '../providers.js';

// Pre-defined corporate capital structure relations for major liquid names
const CAPITAL_STRUCTURES = {
  AAPL: {
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    equities: [
      { ticker: 'AAPL US', name: 'Apple Inc. Common Stock', type: 'Common Stock', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'APC GY', name: 'Apple Inc. Frankfurt Listing', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
      { ticker: '0R2V LN', name: 'Apple Inc. London RegS', type: 'Depository Receipt', exchange: 'LSE', currency: 'USD' },
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: 'Standard US monthly and weekly calls/puts' },
      { name: 'Apple 30D Implied Volatility', function: 'VOL', description: 'At-the-money implied volatility surface' },
    ],
    peers: [
      { ticker: 'MSFT US', name: 'Microsoft Corporation', relation: 'Direct Competitor (OS, Cloud, Devices)' },
      { ticker: 'GOOGL US', name: 'Alphabet Inc.', relation: 'Direct Competitor (Mobile OS, Services)' },
      { ticker: 'NVDA US', name: 'NVIDIA Corporation', relation: 'Silicon & Hardware Partner / Peer' },
      { ticker: 'AMZN US', name: 'Amazon.com Inc.', relation: 'Competitor (Streaming, Smart Home)' },
    ]
  },
  MSFT: {
    name: 'Microsoft Corp.',
    sector: 'Technology',
    industry: 'Software - Infrastructure',
    equities: [
      { ticker: 'MSFT US', name: 'Microsoft Corp Common Stock', type: 'Common Stock', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'MSF GY', name: 'Microsoft Corp Frankfurt Listing', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: 'Standard US monthly and weekly calls/puts' },
    ],
    peers: [
      { ticker: 'AAPL US', name: 'Apple Inc.', relation: 'Peer & Technology Leader' },
      { ticker: 'GOOGL US', name: 'Alphabet Inc.', relation: 'Cloud & AI Competitor' },
      { ticker: 'ORCL US', name: 'Oracle Corporation', relation: 'Enterprise Database Competitor' },
    ]
  },
  GOOGL: {
    name: 'Alphabet Inc.',
    sector: 'Communication Services',
    industry: 'Internet Content & Information',
    equities: [
      { ticker: 'GOOGL US', name: 'Alphabet Inc. Class A Common Stock (1 Vote)', type: 'Class A Voting', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'GOOG US', name: 'Alphabet Inc. Class C Capital Stock (No Vote)', type: 'Class C Non-Voting', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'ABEA GY', name: 'Alphabet Inc. Frankfurt Listing', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: 'Class A & Class C options chains' },
    ],
    peers: [
      { ticker: 'META US', name: 'Meta Platforms Inc.', relation: 'Digital Advertising Competitor' },
      { ticker: 'MSFT US', name: 'Microsoft Corporation', relation: 'AI & Cloud Competitor' },
      { ticker: 'AAPL US', name: 'Apple Inc.', relation: 'Mobile Ecosystem Competitor' },
    ]
  },
  TSLA: {
    name: 'Tesla Inc.',
    sector: 'Consumer Discretionary',
    industry: 'Auto Manufacturers',
    equities: [
      { ticker: 'TSLA US', name: 'Tesla Inc Common Stock', type: 'Common Stock', exchange: 'NASDAQ', currency: 'USD' },
      { ticker: 'TL0 GY', name: 'Tesla Inc Frankfurt Listing', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: 'Active retail & institutional options' },
    ],
    peers: [
      { ticker: 'F US', name: 'Ford Motor Company', relation: 'EV & Automotive Competitor' },
      { ticker: 'GM US', name: 'General Motors', relation: 'Automotive Competitor' },
      { ticker: 'BYD HK', name: 'BYD Company Limited', relation: 'Global EV Manufacturer Peer' },
    ]
  },
  JPM: {
    name: 'JPMorgan Chase & Co.',
    sector: 'Financials',
    industry: 'Diversified Banking',
    equities: [
      { ticker: 'JPM US', name: 'JPMorgan Chase & Co. Common Stock', type: 'Common Stock', exchange: 'NYSE', currency: 'USD' },
      { ticker: 'JPM-PC US', name: 'JPMorgan Chase 6.00% Non-Cum Preferred C', type: 'Preferred Stock', exchange: 'NYSE', currency: 'USD' },
      { ticker: 'JPM-PD US', name: 'JPMorgan Chase 5.75% Non-Cum Preferred D', type: 'Preferred Stock', exchange: 'NYSE', currency: 'USD' },
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: 'Standard US options' },
    ],
    peers: [
      { ticker: 'BAC US', name: 'Bank of America Corp', relation: 'Major US Commercial & Investment Bank' },
      { ticker: 'GS US', name: 'Goldman Sachs Group Inc', relation: 'Wall Street Investment Banking Peer' },
      { ticker: 'MS US', name: 'Morgan Stanley', relation: 'Wealth Management & Trading Peer' },
      { ticker: 'C US', name: 'Citigroup Inc', relation: 'Global Commercial Banking Peer' },
    ]
  },
  BABA: {
    name: 'Alibaba Group Holding Ltd.',
    sector: 'Consumer Discretionary',
    industry: 'Internet Retail',
    equities: [
      { ticker: 'BABA US', name: 'Alibaba Group Holding ADR', type: 'American Depository Receipt (1:8)', exchange: 'NYSE', currency: 'USD' },
      { ticker: '9988 HK', name: 'Alibaba Group Holding Ordinary Shares', type: 'Primary Ordinary Listing', exchange: 'HKEX', currency: 'HKD' },
      { ticker: 'AHLA GY', name: 'Alibaba Group Frankfurt', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
    ],
    derivatives: [
      { name: 'ADR Options Chain', function: 'OMON', description: 'NYSE listed ADR options' },
    ],
    peers: [
      { ticker: '0700 HK', name: 'Tencent Holdings Ltd', relation: 'China Tech & Cloud Conglomerate' },
      { ticker: 'JD US', name: 'JD.com Inc ADR', relation: 'E-commerce & Logistics Competitor' },
      { ticker: 'PDD US', name: 'PDD Holdings Inc', relation: 'Global E-commerce (Temu) Competitor' },
    ]
  },
  TCEHY: {
    name: 'Tencent Holdings Ltd.',
    sector: 'Communication Services',
    industry: 'Interactive Media & Services',
    equities: [
      { ticker: '0700 HK', name: 'Tencent Holdings Ltd Ordinary Shares', type: 'Primary Ordinary Listing', exchange: 'HKEX', currency: 'HKD' },
      { ticker: 'TCEHY US', name: 'Tencent Holdings ADR (Unsponsored 1:1)', type: 'American Depository Receipt', exchange: 'OTC', currency: 'USD' },
      { ticker: 'NNND GY', name: 'Tencent Holdings Frankfurt', type: 'Secondary Listing', exchange: 'XETRA', currency: 'EUR' },
    ],
    derivatives: [],
    peers: [
      { ticker: '9988 HK', name: 'Alibaba Group Holding', relation: 'China Internet Leader' },
      { ticker: '9618 HK', name: 'JD.com Inc', relation: 'E-commerce Partner/Competitor' },
      { ticker: '3690 HK', name: 'Meituan', relation: 'Local Services Platform Peer' },
    ]
  }
};

export default async function (q) {
  const sym = String(q.symbol || q.ticker || 'AAPL').toUpperCase().replace(/\s+(US|EQUITY|CORP|GOVT)$/i, '').trim();

  // Find related bonds from the comprehensive BOND_UNIVERSE
  const relatedBonds = BOND_UNIVERSE.filter(b => {
    if (b.type === 'govt') return false;
    const idMatch = b.id && b.id.toUpperCase().startsWith(`${sym}_`);
    const issuerMatch = b.issuer && b.issuer.toUpperCase().includes(sym);
    const nameMatch = b.name && b.name.toUpperCase().includes(sym);
    return idMatch || issuerMatch || nameMatch;
  }).map(b => ({
    cusip: b.cusip,
    name: b.name,
    coupon: b.coupon,
    maturity: b.maturity,
    rating: b.rating,
    seniority: b.seniority || 'Senior Unsecured',
    currency: b.currency || 'USD',
    ytm: b.ytm,
    cleanPrice: b.cleanPrice
  }));

  const cap = CAPITAL_STRUCTURES[sym] || {
    name: `${sym} Corporation`,
    sector: 'Corporate',
    industry: 'General',
    equities: [
      { ticker: `${sym} US`, name: `${sym} Common Stock`, type: 'Common Stock', exchange: 'US Composite', currency: 'USD' }
    ],
    derivatives: [
      { name: 'Equity Options Chain', function: 'OMON', description: `Standard options chain for ${sym}` }
    ],
    peers: []
  };

  return {
    symbol: sym,
    name: cap.name,
    sector: cap.sector,
    industry: cap.industry,
    equities: cap.equities,
    debt: relatedBonds,
    derivatives: cap.derivatives,
    peers: cap.peers,
    source: `Amber Terminal Capital Structure & Relations engine (OSBAP debt mapping)`
  };
}
