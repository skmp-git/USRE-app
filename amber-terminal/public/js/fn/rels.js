// Screen: RELS (Related Securities & Capital Structure)
// Bloomberg-style RELS displaying capital structure, equity share classes, debt issues, and peer securities.
import { api, esc, pct, num } from '../api.js';
import { table, sect, html, buildCsv, downloadText } from '../ui.js';

export default [
  {
    id: 'RELS',
    name: 'Related securities',
    group: 'Equities',
    needs: false,
    source: 'Amber Terminal Capital Structure & Relations engine',
    async render(ctx) {
      let rawSym = (ctx.args[0] || (ctx.sec && ctx.sec.id) || 'AAPL').toUpperCase();
      // Clean ticker suffix
      const sym = rawSym.replace(/\s+(US|EQUITY|CORP|GOVT)$/i, '').trim();

      ctx.el.innerHTML = `<div class="hdr-bar">
        <h3>RELS Related Securities · ${esc(sym)}</h3>
        <div style="display:inline-flex; gap:6px;">
          <input type="text" class="input rels-input" value="${esc(sym)}" placeholder="Ticker (e.g. AAPL, MSFT, JPM)" style="width:140px; padding:2px 6px;" />
          <button class="btn rels-search-btn">Go</button>
          <button class="btn rels-export-btn">Export CSV</button>
        </div>
      </div>
      <div class="rels-container" style="padding: 8px; overflow-y: auto;">
        <div class="dim">Loading related securities and capital structure for ${esc(sym)}...</div>
      </div>`;

      const input = ctx.el.querySelector('.rels-input');
      const searchBtn = ctx.el.querySelector('.rels-search-btn');
      const exportBtn = ctx.el.querySelector('.rels-export-btn');
      const container = ctx.el.querySelector('.rels-container');

      const doSearch = () => {
        const val = input.value.trim();
        if (val) ctx.go(`${val} RELS`);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doSearch();
      });
      searchBtn.addEventListener('click', doSearch);

      let currentData = null;

      exportBtn.addEventListener('click', () => {
        if (!currentData) return;
        const rows = [];
        (currentData.equities || []).forEach(e => {
          rows.push({ Category: 'Equity', Identifier: e.ticker, Name: e.name, Type: e.type, Exchange: e.exchange, Details: e.currency });
        });
        (currentData.debt || []).forEach(d => {
          rows.push({ Category: 'Debt', Identifier: d.cusip, Name: d.name, Type: d.seniority, Exchange: d.maturity, Details: `Coupon: ${d.coupon}%, YTM: ${d.ytm}%` });
        });
        (currentData.peers || []).forEach(p => {
          rows.push({ Category: 'Peer/Competitor', Identifier: p.ticker, Name: p.name, Type: 'Competitor', Exchange: '', Details: p.relation });
        });
        const csv = buildCsv(rows, ['Category', 'Identifier', 'Name', 'Type', 'Exchange', 'Details']);
        downloadText(`${sym}_RELS_Related_Securities.csv`, csv);
      });

      const d = await api.fn('rels', { symbol: sym });
      if (!ctx.live()) return;
      currentData = d;
      ctx.setSource(d.source);

      container.innerHTML = `
        <div style="margin-bottom:12px; padding:6px 10px; background:#1b1b1b; border-left:3px solid var(--amber);">
          <span style="font-weight:bold; color:var(--amber); font-size:1.1em;">${esc(d.name || sym)}</span>
          <span class="dim" style="margin-left:10px;">Sector: <b>${esc(d.sector || '—')}</b> · Industry: <b>${esc(d.industry || '—')}</b></span>
        </div>
      `;

      // 1. Equity Share Classes
      const eqSec = sect(`Equity Capital Structure (${(d.equities || []).length} share classes)`);
      container.append(eqSec);
      if (d.equities && d.equities.length) {
        const eqTable = table(d.equities, [
          { key: 'ticker', label: 'Ticker', left: true, lbl: true, fmt: (v) => `<span class="amber" style="cursor:pointer;" onclick="window.__goSec('${esc(v)}')">${esc(v)}</span>`, html: true },
          { key: 'name', label: 'Security Description', left: true },
          { key: 'type', label: 'Class / Structure', left: true },
          { key: 'exchange', label: 'Exchange', left: true, cls: () => 'dim' },
          { key: 'currency', label: 'Ccy' },
          { key: 'action', label: 'Action', html: true, fmt: (_, r) => `<button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.ticker)} DES')">DES</button> <button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.ticker)} GP')">GP</button>` }
        ]);
        container.append(eqTable);
      } else {
        container.append(html(`<div class="dim" style="padding:4px 0 10px 0;">No secondary equity classes listed.</div>`));
      }

      // 2. Debt & Fixed Income Issues
      const debtSec = sect(`Debt & Bond Obligations (${(d.debt || []).length} active issues)`);
      container.append(debtSec);
      if (d.debt && d.debt.length) {
        const debtTable = table(d.debt, [
          { key: 'cusip', label: 'CUSIP', left: true, lbl: true, fmt: (v) => `<span class="amber" style="cursor:pointer;" onclick="window.__goSec('${esc(v)} YAS')">${esc(v)}</span>`, html: true },
          { key: 'name', label: 'Bond Issue Description', left: true },
          { key: 'seniority', label: 'Seniority', left: true, cls: () => 'dim' },
          { key: 'coupon', label: 'Coupon', fmt: (v) => `${num(v, 3)}%` },
          { key: 'maturity', label: 'Maturity', left: true },
          { key: 'rating', label: 'Rating', cls: () => 'dim' },
          { key: 'ytm', label: 'YTM', fmt: (v) => v ? `${num(v, 2)}%` : '—' },
          { key: 'cleanPrice', label: 'Price', fmt: (v) => v ? num(v, 2) : '—' },
          { key: 'action', label: 'Action', html: true, fmt: (_, r) => `<button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.cusip)} YAS')">YAS</button> <button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.cusip)} FIRV')">FIRV</button>` }
        ]);
        container.append(debtTable);
      } else {
        container.append(html(`<div class="dim" style="padding:4px 0 10px 0;">No fixed income bond issues registered in the core universe. Try <span class="amber" style="cursor:pointer;" onclick="window.__goSec('SRCH')">SRCH</span> to screen custom CUSIPs.</div>`));
      }

      // 3. Peers & Competitors
      if (d.peers && d.peers.length) {
        const peerSec = sect(`Peers & Industry Competitors (${d.peers.length})`);
        container.append(peerSec);
        const peerTable = table(d.peers, [
          { key: 'ticker', label: 'Ticker', left: true, lbl: true, fmt: (v) => `<span class="amber" style="cursor:pointer;" onclick="window.__goSec('${esc(v)}')">${esc(v)}</span>`, html: true },
          { key: 'name', label: 'Company Name', left: true },
          { key: 'relation', label: 'Competitive Relationship', left: true, cls: () => 'dim' },
          { key: 'action', label: 'Action', html: true, fmt: (_, r) => `<button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.ticker)} DES')">DES</button> <button class="btn" style="padding:1px 4px; font-size:0.8em;" onclick="window.__goSec('${esc(r.ticker)} RELS')">RELS</button>` }
        ]);
        container.append(peerTable);
      }

      // Quick navigate helper in window
      if (!window.__goSec) {
        window.__goSec = (cmd) => ctx.go(cmd);
      }
    }
  }
];
