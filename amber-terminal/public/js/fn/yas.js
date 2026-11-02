// Fixed Income screen: YAS (Yield & Spread / Bond Valuation and Risk Calculator)
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
  ctx.setTitle(`${d.instrument.name}  ·  Fixed Income Calculator`);

  // Presets selector tabs
  const presetLabels = d.presets.map((p) => p.name);
  const activePreset = d.presets.find(
    (p) => p.years === state.years && p.coupon === state.coupon,
  )?.name;

  ctx.el.append(
    tabs(presetLabels, activePreset || presetLabels[2], (label) => {
      const p = d.presets.find((x) => x.name === label);
      if (p) {
        state.years = p.years;
        state.coupon = p.coupon;
        state.price = 100;
        state.yield = null;
        state.freq = p.freq;
        loadAndDraw();
      }
    }),
  );

  // Top Metrics Header
  const b = d.benchmark;
  const p = d.pricing;
  const r = d.risk;

  ctx.el.append(
    html(
      `<div style="display:flex;gap:18px;flex-wrap:wrap;margin:8px 0;align-items:baseline">
        <div><span class="dim">Clean Price:</span> <b class="amber" style="font-size:16px">${px(p.cleanPrice)}</b></div>
        <div><span class="dim">Yield (YTM):</span> <b class="amber" style="font-size:16px">${pctv(p.ytm)}</b></div>
        <div><span class="dim">Current Yield:</span> <b>${pctv(p.currentYield)}</b></div>
        <div><span class="dim">Benchmark (${b.tenor}):</span> <b>${pctv(b.yield)}</b></div>
        <div><span class="dim">Spread (G-Spread):</span> <b class="${cls(b.spreadBp)}">${bp(b.spreadBp)}</b></div>
      </div>`,
    ),
  );

  // Risk Parameters Summary Box
  ctx.el.append(
    html(
      `<div style="display:flex;gap:18px;flex-wrap:wrap;margin:4px 0 10px;padding:6px 10px;background:var(--card-bg,#16191f);border-left:3px solid var(--amber)">
        <div><span class="dim">Modified Duration:</span> <b class="amber">${num(r.modDuration, 2)} yrs</b></div>
        <div><span class="dim">Macaulay Duration:</span> <b>${num(r.macDuration, 2)} yrs</b></div>
        <div><span class="dim">DV01 per $100:</span> <b>$${num(r.dv01, 4)}</b></div>
        <div><span class="dim">DV01 per $100k face:</span> <b class="amber">$${num(r.dv01Per100k, 2)}</b></div>
        <div><span class="dim">Convexity:</span> <b>${num(r.convexity, 2)}</b></div>
      </div>`,
    ),
  );

  // Interactive Parameter Inputs form
  const formHtml = html(
    `<div style="margin:10px 0;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font-size:12px">
      <label>Coupon %: <input type="number" step="0.125" style="width:65px" id="yas-coupon" value="${state.coupon}"></label>
      <label>Maturity (Yrs): <input type="number" step="0.5" style="width:55px" id="yas-years" value="${state.years}"></label>
      <label>Price: <input type="number" step="0.25" style="width:75px" id="yas-price" value="${p.cleanPrice}"></label>
      <label>YTM %: <input type="number" step="0.05" style="width:70px" id="yas-yield" value="${p.ytm}"></label>
      <button id="yas-calc" class="btn" style="padding:2px 10px;cursor:pointer">Price / Recalculate</button>
    </div>`,
  );

  formHtml.querySelector("#yas-calc").onclick = (e) => {
    e.preventDefault();
    state.coupon = parseFloat(formHtml.querySelector("#yas-coupon").value) || 0;
    state.years = parseFloat(formHtml.querySelector("#yas-years").value) || 1;
    const inpPrice = parseFloat(formHtml.querySelector("#yas-price").value);
    const inpYield = parseFloat(formHtml.querySelector("#yas-yield").value);

    // If user changed yield from previous, solve price; else solve yield from price
    if (fin(inpYield) && Math.abs(inpYield - p.ytm) > 0.001) {
      state.yield = inpYield;
      state.price = null;
    } else {
      state.price = fin(inpPrice) ? inpPrice : 100;
      state.yield = null;
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
      { key: "newPrice", label: "Exact Price", fmt: (v) => px(v, 3), cls: () => "amber" },
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

  // Navigation and educational notes
  ctx.el.append(
    links(
      html(
        `<div class="hint" style="margin-top:8px">
          <b>YAS (Yield & Spread):</b> Analyzes bond price, cash flows, and duration risk.
          DV01 is the dollar gain/loss per 1 basis point yield move.
          G-Spread is the extra yield over the on-the-run US Treasury benchmark.
          Related screens: <a href="#" data-c="GC">GC yield curves</a> · <a href="#" data-c="BTMM">BTMM money markets</a> · <a href="#" data-c="CRED">CRED credit spreads</a> · <a href="#" data-c="AUCT">AUCT auctions</a>
        </div>`,
      ),
      ctx,
    ),
  );

  ctx.setSource(d.source);

  async function loadAndDraw() {
    const res = await api.fn("yas", {
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
    name: "Yield and Spread (Fixed Income Pricing & Risk)",
    group: "Rates",
    needs: undefined,
    source: "Amber Terminal fixed income pricer; US Treasury par curve",
    async render(ctx) {
      // Parse arguments: e.g. YAS 10 4.5 98.5
      let years = 10;
      let coupon = 4.5;
      let price = null;
      let ytm = null;

      const args = ctx.args || [];
      if (args[0] && fin(+args[0])) years = +args[0];
      if (args[1] && fin(+args[1])) coupon = +args[1];
      if (args[2] && fin(+args[2])) price = +args[2];

      const state = { years, coupon, price, yield: ytm, freq: 2 };
      const d = await api.fn("yas", { coupon, years, price, yield: ytm, freq: 2 });
      if (ctx.live()) yasView(ctx, d, state);
    },
  },
];
