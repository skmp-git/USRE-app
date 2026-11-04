// Tests for Fixed Income Relative Value: FIRV
import { test } from "node:test";
import assert from "node:assert/strict";
import firv from "../lib/fn/firv.js";

test("FIRV: resolves sector peers for a corporate target", async () => {
  const res = await firv({ ticker: "AAPL_2030" });
  assert.equal(res.target.issuer, "Apple Inc.");
  assert.equal(res.target.sector, "Technology");
  assert.ok(res.peerCount >= 3);
  assert.ok(res.rows.some((r) => r.isTarget === true));

  // Every peer should have computed curve analytics
  for (const r of res.rows) {
    assert.ok(r.cleanPrice > 0);
    assert.ok(r.ytm > 0);
    assert.ok(r.approxDuration > 0);
    assert.ok(Number.isFinite(r.fittedSpread));
    assert.ok(Number.isFinite(r.residualBp));
    assert.ok(["cheap", "rich", "fair"].includes(r.valClass));
  }
});

test("FIRV: fits linear regression equation through sector curve", async () => {
  const res = await firv({ ticker: "JPM_2029" });
  assert.equal(res.target.sector, "Finance");
  assert.ok(res.curveFit.equation.includes("Spread (bp)"));
  assert.ok(Number.isFinite(res.curveFit.slope));
  assert.ok(Number.isFinite(res.curveFit.intercept));
});

test("FIRV: supports looking up peers by CUSIP", async () => {
  const res = await firv({ cusip: "594918BW7" }); // Microsoft 2033
  assert.equal(res.target.issuer, "Microsoft Corp.");
  assert.equal(res.target.sector, "Technology");
  assert.ok(res.rows.length >= 3);
});

test("FIRV: compares sovereign benchmark peers for US Treasuries", async () => {
  const res = await firv({ ticker: "US10Y" });
  assert.equal(res.target.type, "govt");
  assert.ok(res.rows.every((r) => r.type === "govt"));
});
