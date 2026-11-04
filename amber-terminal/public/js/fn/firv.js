// Fixed Income Relative Value Screen: FIRV
// Mirrors Bloomberg Terminal's FIRV function: sector peer comparison, spread vs duration regression,
// and cheap/rich valuation indicator with data export.
import { api, esc, num, cls } from "../api.js";
import { table, sect, html, buildCsv, downloadText, csvName } from "../ui.js";

const fin = Number.isFinite;
const pctv = (v, d = 2) => (fin(v) ? `${num(v, d)}%` : "—");
const bp = (v, d = 1) => (fin(v) ? `${v > 0 ? "+" : ""}${num(v, d)} bp` : "—");
const px = (v, d = 2) => (fin(v) ? num(v, d) : "—");

const FIRV_COLS = [
  { key: "cusip", label: "CUSIP", left: true, lbl: true },
  {
    key: "name",
    label: "Security Name",
    left: true,
    cls: (v, r) => (r.isTarget ? "amber" : ""),
  },
  { key: "rating", label: "Rating", left: true },
  { key: "years", label: "Maturity", fmt: (v) => `${num(v, 1)}y` },
  { key: "approxDuration", label: "Duration", fmt: (v) => `${num(v, 2)}y` },
  { key: "coupon", label: "Coupon", fmt: (v) => pctv(v, 3) },
  { key: "cleanPrice", label: "Clean Px", fmt: (v) => px(v, 2) },
  { key: "ytm", label: "YTM", fmt: (v) => pctv(v, 2), cls: () => "amber" },
  { key: "spreadBp", label: "Spread", fmt: (v) => bp(v, 1), cls },
  { key: "fittedSpread", label: "Fitted Spread", fmt: (v) => bp(v, 1), cls: () => "dim" },
  {
    key: "relativeValue",
    label: "Relative Value",
    cls: (v, r) => (r.valClass === "cheap" ? "pos" : r.valClass === "rich" ? "neg" : "dim"),
  },
  {
    key: () => `<button class="btn" style="padding:1px 6px;font-size:10px;cursor:pointer">YAS</button>`,
    label: "Analyze",
    html: true,
  },
];

async function renderFirv(ctx) {
  let target = ctx.args[0] || (ctx.sec?.ticker ? `${ctx.sec.ticker}_2030` : "AAPL_2030");

  const headerBar = html(
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 10px;background:#151a23;border-left:3px solid var(--amber);flex-wrap:wrap">
      <span class="amber" style="font-weight:bold">FIRV TARGET:</span>
      <input type="text" id="firv-input" placeholder="Issuer / Ticker / CUSIP (e.g. AAPL, MSFT, 037833EK3)" value="${esc(target)}" style="padding:3px 8px;width:240px;background:#0d1117;color:var(--text);border:1px solid #4a5568;font-family:monospace">
      <button id="firv-btn" class="btn" style="padding:3px 12px;cursor:pointer;background:var(--amber);color:#000;font-weight:bold;border:none">COMPARE PEERS</button>
      <button id="firv-export" class="btn" style="padding:3px 12px;cursor:pointer">EXPORT CSV</button>
      <span class="dim" style="margin-left:6px">Quick Targets:</span>
      <div style="display:inline-flex;gap:6px">
        <a href="#" class="firv-quick mono" data-target="AAPL_2030" style="color:var(--amber);text-decoration:none;border-bottom:1px dotted">AAPL (Tech)</a>
        <a href="#" class="firv-quick mono" data-target="JPM_2029" style="color:var(--amber);text-decoration:none;border-bottom:1px dotted">JPM (Finance)</a>
        <a href="#" class="firv-quick mono" data-target="XOM_2030" style="color:var(--amber);text-decoration:none;border-bottom:1px dotted">XOM (Energy)</a>
        <a href="#" class="firv-quick mono" data-target="BA_2031" style="color:var(--amber);text-decoration:none;border-bottom:1px dotted">BA (Industrials)</a>
        <a href="#" class="firv-quick mono" data-target="US10Y" style="color:var(--amber);text-decoration:none;border-bottom:1px dotted">US Treasuries</a>
      </div>
    </div>`
  );

  const summary = html(`<div style="margin:4px 0 8px;font-size:12px"></div>`);
  const body = document.createElement("div");
  ctx.el.innerHTML = "";
  ctx.el.append(headerBar, summary, body);

  const load = async () => {
    body.innerHTML = `<div class="loading">Calculating sector relative value comps</div>`;
    const d = await api.fn("firv", { ticker: target });
    if (!ctx.live()) return;

    ctx.setTitle(`${d.target.name}  ·  FIRV Sector Comps (${d.sector})`);

    summary.innerHTML =
      `<div style="display:flex;justify-content:space-between;background:var(--card-bg,#16191f);padding:6px 10px;border:1px solid #28303d;flex-wrap:wrap;gap:8px">` +
        `<div>` +
          `Target: <b class="amber">${esc(d.target.name)}</b> ` +
          `<span class="dim">(${esc(d.target.sector)} · CUSIP: ${esc(d.target.cusip || "N/A")})</span>` +
        `</div>` +
        `<div>` +
          `<span class="dim">Sector Regression:</span> <span class="mono">${esc(d.curveFit.equation)}</span> ` +
          `<span class="dim">(${d.peerCount} comparable issues)</span>` +
        `</div>` +
      `</div>`;

    body.innerHTML = "";
    body.append(sect(`Comparable Bonds & Curve Valuation (${d.sector} Sector Universe)`));

    const t = table(d.rows, FIRV_COLS, {
      onRow: (r) => ctx.go(`${r.cusip || r.id} YAS`),
    });

    // Row buttons
    t.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      e.stopPropagation();
      const tr = e.target.closest("tr[data-i]");
      if (!tr) return;
      const row = d.rows[+tr.dataset.i];
      ctx.go(`${row.cusip || row.id} YAS`);
    });

    body.append(
      t,
      html(
        `<div class="hint" style="margin-top:8px">
          <b>Relative Value Methodology:</b> Fits an ordinary least-squares regression line (Spread = α + β × Duration) through sector peers.
          Bonds trading wider than their fitted spread by >12 bp are classified as <span class="pos">CHEAP</span> (higher yield for the same duration risk),
          while those trading tighter by >12 bp are classified as <span class="neg">RICH</span>. Click any bond or YAS button to inspect full analytics.
        </div>`
      )
    );

    // Export handler
    headerBar.querySelector("#firv-export").onclick = () => {
      const exportRows = [
        ["CUSIP", "Security Name", "Issuer", "Sector", "Rating", "Maturity (Yrs)", "Duration (Yrs)", "Coupon (%)", "Clean Price", "YTM (%)", "Spread (bp)", "Fitted Spread (bp)", "Relative Value"],
        ...d.rows.map((r) => [
          r.cusip || "",
          r.name,
          r.issuer,
          r.sector,
          r.rating,
          r.years,
          r.approxDuration,
          r.coupon,
          r.cleanPrice,
          r.ytm,
          r.spreadBp,
          r.fittedSpread,
          r.relativeValue,
        ]),
      ];
      const csv = buildCsv([
        {
          title: `FIRV Relative Value Comps - Target: ${d.target.name} (${d.sector})`,
          rows: exportRows,
        },
      ]);
      downloadText(csvName("FIRV", target), csv);
      ctx.toast(`Exported ${d.rows.length} comparable bonds to CSV`);
    };

    ctx.setSource(d.source);
  };

  const doTargetChange = (newTarget) => {
    if (!newTarget) return;
    target = newTarget.trim().toUpperCase();
    headerBar.querySelector("#firv-input").value = target;
    load();
  };

  headerBar.querySelector("#firv-btn").onclick = (e) => {
    e.preventDefault();
    doTargetChange(headerBar.querySelector("#firv-input").value);
  };

  headerBar.querySelector("#firv-input").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      doTargetChange(headerBar.querySelector("#firv-input").value);
    }
  };

  headerBar.querySelectorAll(".firv-quick").forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      doTargetChange(el.dataset.target);
    };
  });

  await load();
}

export default [
  {
    id: "FIRV",
    name: "Fixed Income Relative Value",
    group: "Rates",
    source: "Amber Terminal fixed income relative value pricer (FIRV)",
    render: renderFirv,
  },
];
