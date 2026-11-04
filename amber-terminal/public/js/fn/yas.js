// Fixed Income & Corporate Bond screen: YAS (Yield & Spread / Corporate Bond Valuation and Risk Calculator)
// Incorporates Open Source Bond Asset Pricing (OSBAP / TRACE Pipeline) methodologies.
import { api, esc, num, cls } from "../api.js";
import { table, sect, tabs, html } from "../ui.js";

const fin = Number.isFinite;
const pctv = (v, d = 3) => (fin(v) ? `${num(v, d)}%` : "—");
const bp = (v, d = 1) => (fin(v) ? `${v > 0 ? "+" : ""}${num(v, d)} bp` : "—");
const px = (v, d = 3) => (fin(v) ? num(v, d) : "—");

function links(el, ctx) {
  el.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-c]");
    if (!a) return;
    e.preventDefault();
    ctx.go(a.dataset.c);
  });
  return el;
}

function yasView(ctx, d, state) {
  ctx.el.innerHTML = "";
  ctx.setTitle(`${d.instrument.name}  ·  Fixed Income & Corporate Bond Pricing`);

  // Presets selector tabs (Categorized into Corporate Benchmarks vs Treasuries)
  const presetLabels = d.presets.map((p) => p.name);
  const activePreset = d.presets.find(
    (p) => p.id === state.presetId || (p.years === state.years && p.coupon === state.coupon),
  )?.name;

  ctx.el.append(
    tabs(presetLabels, activePreset || presetLabels[4], (label) => {
      const p = d.presets.find((x) => x.name === label);
      if (p) {
        state.presetId = p.id;
        state.years = p.years;
        state.coupon = p.coupon;
        state.type = p.type || "corp";
        state.rating = p.rating;
        state.spreadBp = p.spreadBp;
        state.issuer = p.issuer;
        state.cusip = p.cusip;
        state.sector = p.sector;
        state.price = null;
        state.yield = null;
        state.freq = p.freq || 2;
        loadAndDraw();
      }
    }),
  );

  // Corporate Security Header Banner
  const inst = d.instrument;
  const c = d.credit;
  const p = d.pricing;
  const r = d.risk;
  const b = d.benchmark;

  const ratingBadgeClass = inst.ratingGrade === "Investment Grade"
    ? "pos"
    : inst.ratingGrade === "High Yield"
    ? "warn"
    : "neg";

  ctx.el.append(
    html(
      `<div style="display:flex;justify-content:space-between;align-items:center;background:#1b212c;padding:6px 10px;margin:6px 0;border-left:3px solid var(--amber);font-size:12px;flex-wrap:wrap;gap:8px">
        <div>
          <b class="amber" style="font-size:14px">${esc(inst.name)}</b>
          <span class="dim" style="margin-left:10px">CUSIP:</span> <span class="mono">${esc(inst.cusip || "N/A")}</span>
          <span class="dim" style="margin-left:10px">Sector:</span> <span>${esc(inst.sector || "General")}</span>
        </div>
        <div>
          <span class="dim">Rating (S&P / Moody's):</span>
          <b class="${ratingBadgeClass}" style="margin:0 4px">${esc(inst.rating)}</b>
          <span class="dim">(${esc(inst.ratingGrade)})</span>
          <span class="dim" style="margin-left:12px">Day Count:</span> <span class="mono">${esc(inst.dayCount || "30/360")}</span>
        </div>
      </div>`,
    ),
  );

  // Pricing & Credit Spread Grid (OSBAP Metric Specification)
  ctx.el.append(
    html(
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:8px 0;padding:8px 10px;background:var(--card-bg,#16191f);border:1px solid #232a35">
        <div>
          <div class="dim" style="font-size:11px">CLEAN PRICE (% PAR)</div>
          <div class="amber" style="font-size:18px;font-weight:bold">${px(p.cleanPrice)}</div>
        </div>
        <div>
          <div class="dim" style="font-size:11px">DIRTY PRICE (PRFULL)</div>
          <div style="font-size:18px;font-weight:bold">${px(p.dirtyPrice)}</div>
        </div>
        <div>
          <div class="dim" style="font-size:11px">ACCRUED (ACCLAST)</div>
          <div style="font-size:16px;font-weight:bold">$${num(p.accruedInterest, 3)}</div>
        </div>
        <div>
          <div class="dim" style="font-size:11px">YIELD TO MATURITY</div>
          <div class="amber" style="font-size:18px;font-weight:bold">${pctv(p.ytm)}</div>
        </div>
        <div>
          <div class="dim" style="font-size:11px">CREDIT SPREAD</div>
          <div class="${cls(c.spreadBp)}" style="font-size:18px;font-weight:bold">${bp(c.spreadBp)}</div>
        </div>
        <div>
          <div class="dim" style="font-size:11px">TREASURY BENCHMARK</div>
          <div style="font-size:16px;font-weight:bold">${pctv(c.interpolatedTreasuryYield)} <span class="dim" style="font-size:11px">(${b.tenor})</span></div>
        </div>
      </div>`,
    ),
  );

  // Risk and Sensitivity Metrics (Duration, DV01, CS01, Convexity)
  ctx.el.append(
    html(
      `<div style="display:flex;gap:18px;flex-wrap:wrap;margin:4px 0 10px;padding:6px 10px;background:var(--card-bg,#16191f);border-left:3px solid #388bfd;font-size:12px">
        <div><span class="dim">Modified Duration:</span> <b class="amber">${num(r.modDuration, 2)} yrs</b></div>
        <div><span class="dim">Macaulay Duration:</span> <b>${num(r.macDuration, 2)} yrs</b></div>
        <div><span class="dim">IR DV01 ($ per $100k):</span> <b class="amber">$${num(r.dv01Per100k, 2)}</b></div>
        <div><span class="dim">CS01 (Spread DV01):</span> <b class="pos">$${num(c.cs01Per100k, 2)}</b></div>
        <div><span class="dim">Convexity:</span> <b>${num(r.convexity, 2)}</b></div>
        <div><span class="dim">Current Yield:</span> <b>${pctv(p.currentYield)}</b></div>
      </div>`,
    ),
  );

  // Interactive Parameter Inputs form
  const formHtml = html(
    `<div style="margin:10px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:12px">
      <label>Type:
        <select id="yas-type" style="padding:1px 4px">
          <option value="corp" ${state.type === "corp" ? "selected" : ""}>Corporate</option>
          <option value="govt" ${state.type === "govt" ? "selected" : ""}>Government (US Treasury)</option>
        </select>
      </label>
      <label>Coupon %: <input type="number" step="0.125" style="width:65px" id="yas-coupon" value="${state.coupon}"></label>
      <label>Maturity (Yrs): <input type="number" step="0.5" style="width:55px" id="yas-years" value="${state.years}"></label>
      <label>Credit Spread (bp): <input type="number" step="5" style="width:70px" id="yas-spread" value="${c.spreadBp}"></label>
      <label>Clean Price: <input type="number" step="0.25" style="width:70px" id="yas-price" value="${p.cleanPrice}"></label>
      <label>YTM %: <input type="number" step="0.05" style="width:65px" id="yas-yield" value="${p.ytm}"></label>
      <button id="yas-calc" class="btn" style="padding:2px 10px;cursor:pointer">Price / Recalculate</button>
    </div>`,
  );

  formHtml.querySelector("#yas-calc").onclick = (e) => {
    e.preventDefault();
    state.type = formHtml.querySelector("#yas-type").value;
    state.coupon = parseFloat(formHtml.querySelector("#yas-coupon").value) || 0;
    state.years = parseFloat(formHtml.querySelector("#yas-years").value) || 1;
    const inpSpread = parseFloat(formHtml.querySelector("#yas-spread").value);
    const inpPrice = parseFloat(formHtml.querySelector("#yas-price").value);
    const inpYield = parseFloat(formHtml.querySelector("#yas-yield").value);

    // Pricing priority
    if (fin(inpYield) && Math.abs(inpYield - p.ytm) > 0.001) {
      state.yield = inpYield;
      state.price = null;
      state.spreadBp = null;
    } else if (fin(inpPrice) && Math.abs(inpPrice - p.cleanPrice) > 0.01) {
      state.price = inpPrice;
      state.yield = null;
      state.spreadBp = null;
    } else if (fin(inpSpread) && Math.abs(inpSpread - c.spreadBp) > 0.1) {
      state.spreadBp = inpSpread;
      state.yield = null;
      state.price = null;
    } else {
      state.price = fin(inpPrice) ? inpPrice : 100;
      state.yield = null;
      state.spreadBp = null;
    }
    loadAndDraw();
  };
  ctx.el.append(formHtml);

  // Rate Shock / Scenario Analysis
  ctx.el.append(sect("Rate Shock Matrix (Price Sensitivity to Yield Shifts)"));
  ctx.el.append(
    table(d.scenarios, [
      {
        key: "shiftBp",
        label: "Yield Shift",
        left: true,
        lbl: true,
        fmt: (v) => `${v > 0 ? "+" : ""}${v} bp`,
      },
      { key: "newYtm", label: "Shifted YTM", fmt: (v) => pctv(v, 2) },
      { key: "newPrice", label: "Clean Price", fmt: (v) => px(v, 3), cls: () => "amber" },
      { key: "dPrice", label: "Dollar Change", fmt: (v) => `${v > 0 ? "+" : ""}${px(v, 3)}`, cls },
      { key: "pctChange", label: "Price % Chg", fmt: (v) => `${v > 0 ? "+" : ""}${px(v, 2)}%`, cls },
      { key: "estPrice", label: "Taylor Approx", fmt: (v) => px(v, 3), cls: () => "dim" },
    ]),
  );

  // Cash Flow Schedule
  ctx.el.append(sect(`Projected Cash Flows (Next ${d.cashFlows.length} of ${d.totalPeriods} periods)`));
  ctx.el.append(
    table(d.cashFlows, [
      { key: "period", label: "Period", left: true, lbl: true },
      { key: "year", label: "Time (Yrs)", left: true, fmt: (v) => `${v}y` },
      { key: "coupon", label: "Coupon", fmt: (v) => `$${num(v, 2)}` },
      { key: "principal", label: "Principal", fmt: (v) => (v > 0 ? `$${num(v, 2)}` : "—") },
      { key: "total", label: "Total Flow", fmt: (v) => `$${num(v, 2)}`, cls: () => "amber" },
      { key: "disc", label: "Discount Factor", fmt: (v) => num(v, 4) },
      { key: "pv", label: "Present Value", fmt: (v) => `$${num(v, 2)}` },
    ]),
  );

  // Corporate Credit Spread Matrix Reference Table (OSBAP Category Model)
  ctx.el.append(sect("OSBAP Credit Spread Matrix by Rating Grade"));
  const ratingMatrix = [
    { grade: "Investment Grade (AAA)", sp: "AAA", mdy: "Aaa", avgSpread: "+45 bp", defaultRisk: "0.01%", comment: "Prime quality (Apple, Microsoft)" },
    { grade: "Investment Grade (AA)", sp: "AA+ to AA-", mdy: "Aa1 to Aa3", avgSpread: "+75 bp", defaultRisk: "0.05%", comment: "High quality (Amazon, Berkshire)" },
    { grade: "Investment Grade (A)", sp: "A+ to A-", mdy: "A1 to A3", avgSpread: "+115 bp", defaultRisk: "0.15%", comment: "Upper medium (JPMorgan, Google)" },
    { grade: "Investment Grade (BBB)", sp: "BBB+ to BBB-", mdy: "Baa1 to Baa3", avgSpread: "+165 bp", defaultRisk: "0.45%", comment: "Lower medium (Tesla, Netflix, Boeing)" },
    { grade: "High Yield (BB)", sp: "BB+ to BB-", mdy: "Ba1 to Ba3", avgSpread: "+290 bp", defaultRisk: "1.80%", comment: "Speculative (Ford, Occidental)" },
    { grade: "High Yield (B)", sp: "B+ to B-", mdy: "B1 to B3", avgSpread: "+510 bp", defaultRisk: "4.50%", comment: "Highly speculative" },
    { grade: "Substantial Risk (CCC)", sp: "CCC+ to CCC-", mdy: "Caa1 to Caa3", avgSpread: "+1,050 bp", defaultRisk: "18.5%", comment: "Vulnerable to default" },
    { grade: "Default (D)", sp: "D", mdy: "D", avgSpread: ">3,000 bp", defaultRisk: "100.0%", comment: "Bankruptcy or missed payments" },
  ];
  ctx.el.append(
    table(ratingMatrix, [
      { key: "grade", label: "Rating Grade", left: true, lbl: true },
      { key: "sp", label: "S&P", left: true },
      { key: "mdy", label: "Moody's", left: true },
      { key: "avgSpread", label: "Typical Spread", cls: () => "amber" },
      { key: "defaultRisk", label: "1Y Default Prob", cls: (v) => (parseFloat(v) > 1 ? "warn" : "dim") },
      { key: "comment", label: "Representative Issuers / Characteristics", left: true },
    ]),
  );

  // Navigation and OSBAP methodology notes
  ctx.el.append(
    links(
      html(
        `<div class="hint" style="margin-top:10px">
          <b>OSBAP Corporate Bond Asset Pricing:</b> Implements Open Source Bond Asset Pricing TRACE pipeline methodologies.
          Calculates dirty prices with 30/360 accrued interest (acclast), maturity-matched Treasury key-rate interpolation (ComputeCredit),
          credit spreads, and spread sensitivity (CS01).
          Related screens: <a href="#" data-c="GC">GC yield curves</a> · <a href="#" data-c="CRED">CRED credit spreads</a> · <a href="#" data-c="EQS">EQS equity screener</a> · <a href="#" data-c="BTMM">BTMM money markets</a>
        </div>`,
      ),
      ctx,
    ),
  );

  ctx.setSource(d.source);

  async function loadAndDraw() {
    const res = await api.fn("yas", {
      preset: state.presetId,
      type: state.type,
      issuer: state.issuer,
      cusip: state.cusip,
      sector: state.sector,
      rating: state.rating,
      spreadBp: state.spreadBp,
      coupon: state.coupon,
      years: state.years,
      price: state.price,
      yield: state.yield,
      freq: state.freq,
    });
    if (ctx.live()) yasView(ctx, res, state);
  }
}

export default [
  {
    id: "YAS",
    name: "Yield and Spread (Corporate & Sovereign Bond Valuation)",
    group: "Rates",
    needs: undefined,
    source: "Amber Terminal fixed income & corporate bond pricer (OSBAP TRACE specification)",
    async render(ctx) {
      // Default: Apple 2030 Corporate Bond preset
      const args = ctx.args || [];
      let years = 5.5;
      let coupon = 4.30;
      let price = null;
      let ytm = null;
      let presetId = "AAPL_2030";
      let type = "corp";

      if (args[0] && fin(+args[0])) {
        years = +args[0];
        presetId = null;
      }
      if (args[1] && fin(+args[1])) coupon = +args[1];
      if (args[2] && fin(+args[2])) price = +args[2];

      const state = { presetId, type, years, coupon, price, yield: ytm, freq: 2 };
      const d = await api.fn("yas", { preset: presetId, coupon, years, price, yield: ytm, freq: 2 });
      if (ctx.live()) yasView(ctx, d, state);
    },
  },
];
