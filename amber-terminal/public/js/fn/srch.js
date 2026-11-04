// Fixed Income & Corporate Bond Search / Screener Screen: SRCH
// Mirrors Bloomberg Terminal's SRCH function with criteria filters, sortable results, and CSV export.
import { api, esc, num, cls } from "../api.js";
import { table, sect, html, buildCsv, downloadText, csvName } from "../ui.js";

const fin = Number.isFinite;
const pctv = (v, d = 2) => (fin(v) ? `${num(v, d)}%` : "—");
const bp = (v, d = 1) => (fin(v) ? `${v > 0 ? "+" : ""}${num(v, d)} bp` : "—");
const px = (v, d = 3) => (fin(v) ? num(v, d) : "—");

const SRCH_COLS = [
  { key: "cusip", label: "CUSIP", left: true, lbl: true },
  { key: "name", label: "Security Name", left: true },
  { key: "issuer", label: "Issuer", left: true },
  { key: "sector", label: "Sector", left: true },
  { key: "rating", label: "Rating", left: true, cls: (v, r) => r.ratingGrade === "Investment Grade" ? "pos" : r.ratingGrade === "High Yield" ? "warn" : "" },
  { key: "coupon", label: "Coupon", fmt: (v) => pctv(v, 3) },
  { key: "years", label: "Maturity", fmt: (v) => `${num(v, 1)}y` },
  { key: "cleanPrice", label: "Clean Px", fmt: (v) => px(v, 2), cls: () => "amber" },
  { key: "ytm", label: "YTM", fmt: (v) => pctv(v, 2), cls: () => "amber" },
  { key: "spreadBp", label: "Spread", fmt: (v) => bp(v, 1), cls },
  {
    key: () => `<button class="btn" style="padding:1px 6px;font-size:10px;cursor:pointer">YAS</button>`,
    label: "Valuation",
    html: true,
  },
  {
    key: () => `<button class="btn" style="padding:1px 6px;font-size:10px;cursor:pointer;background:#1a233a;color:#5aaeff">FIRV</button>`,
    label: "Comps",
    html: true,
  },
];

async function renderSrch(ctx) {
  let query = { q: ctx.args.join(" ") };
  let filters = {};

  const form = html(
    `<form class="wform" autocomplete="off" style="margin-bottom:6px;gap:6px;flex-wrap:wrap">
      <input name="q" placeholder="Keyword / Ticker / CUSIP" style="width:170px" value="${esc(query.q || "")}">
      <select name="type">
        <option value="all">All Types</option>
        <option value="corp">Corporate</option>
        <option value="govt">Government (US Treasury)</option>
      </select>
      <select name="sector">
        <option value="all">All Sectors</option>
      </select>
      <select name="ratingGrade">
        <option value="all">All Grades</option>
        <option value="ig">Investment Grade</option>
        <option value="hy">High Yield</option>
        <option value="sov">Sovereign</option>
      </select>
      <span class="dim">Coupon:</span>
      <input name="couponMin" placeholder="Min %" style="width:55px">
      <input name="couponMax" placeholder="Max %" style="width:55px">
      <span class="dim">Mat (Yrs):</span>
      <input name="yearsMin" placeholder="Min" style="width:45px">
      <input name="yearsMax" placeholder="Max" style="width:45px">
      <button type="submit" class="btn" style="background:var(--amber);color:#000;font-weight:bold;padding:2px 10px">Search</button>
      <button type="button" data-export class="btn" style="padding:2px 10px">Export CSV</button>
      <button type="button" data-reset class="btn" style="padding:2px 8px">Clear</button>
    </form>`
  );

  const info = html(`<div class="hint" style="margin:2px 0 6px"></div>`);
  const body = document.createElement("div");
  ctx.el.innerHTML = "";
  ctx.el.append(form, info, body);

  const currentFormQuery = () => {
    const q = { sort: filters.sort || "years", dir: filters.dir || "asc" };
    for (const el of form.elements) {
      if (el.name && el.value && el.value !== "all") q[el.name] = el.value.trim();
    }
    return q;
  };

  const load = async () => {
    body.innerHTML = `<div class="loading">Searching bond database</div>`;
    const d = await api.fn("srch", query);
    if (!ctx.live()) return;
    filters = d.filters;

    // Populate sectors dropdown dynamically if not yet filled
    const secSelect = form.querySelector("select[name=sector]");
    if (secSelect.children.length <= 1) {
      for (const s of d.sectors) {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        if (s.toLowerCase() === (filters.sector || "").toLowerCase()) opt.selected = true;
        secSelect.append(opt);
      }
    }

    info.innerHTML = `Found <b class="amber">${d.total}</b> bonds matching criteria across ${d.universeSize} universe securities. Sorted by <b>${filters.sort}</b> (${filters.dir}). Click row or button to view YAS valuation or FIRV relative value comps.`;

    body.innerHTML = "";
    const t = table(d.rows, SRCH_COLS, {
      onRow: (r) => ctx.go(`${r.cusip || r.id} YAS`),
    });

    // Handle button clicks in row
    t.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      e.stopPropagation();
      const tr = e.target.closest("tr[data-i]");
      if (!tr) return;
      const row = d.rows[+tr.dataset.i];
      if (btn.textContent.trim() === "FIRV") {
        ctx.go(`${row.cusip || row.id} FIRV`);
      } else {
        ctx.go(`${row.cusip || row.id} YAS`);
      }
    });

    // Sort column headers
    t.querySelectorAll("th").forEach((th, idx) => {
      const col = SRCH_COLS[idx];
      if (!col || typeof col.key === "function") return;
      th.style.cursor = "pointer";
      if (col.key === filters.sort) th.textContent += filters.dir === "asc" ? " ▲" : " ▼";
      th.onclick = () => {
        const nextDir = col.key === filters.sort ? (filters.dir === "asc" ? "desc" : "asc") : "asc";
        query = { ...currentFormQuery(), sort: col.key, dir: nextDir };
        load();
      };
    });

    body.append(t);

    // Export handler
    form.querySelector("[data-export]").onclick = () => {
      const exportRows = [
        ["CUSIP", "Security Name", "Issuer", "Sector", "Rating", "Coupon (%)", "Maturity (Yrs)", "Clean Price", "YTM (%)", "Spread (bp)"],
        ...d.rows.map((r) => [
          r.cusip || "",
          r.name,
          r.issuer,
          r.sector,
          r.rating,
          r.coupon,
          r.years,
          r.cleanPrice,
          r.ytm,
          r.spreadBp,
        ]),
      ];
      const csv = buildCsv([{ title: `Amber Terminal Bond Screener (SRCH) - ${d.rows.length} bonds`, rows: exportRows }]);
      downloadText(csvName("SRCH", query.q || "bonds"), csv);
      ctx.toast(`Exported ${d.rows.length} bonds to CSV`);
    };

    ctx.setSource(d.source);
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    query = currentFormQuery();
    load();
  };

  form.querySelector("[data-reset]").onclick = () => {
    form.reset();
    query = {};
    load();
  };

  await load();
}

export default [
  {
    id: "SRCH",
    name: "Bond Search & Screener",
    group: "Rates",
    source: "Amber Terminal fixed income & corporate bond screener (SRCH)",
    render: renderSrch,
  },
];
