// Tests for Fixed Income & Corporate Bond Screener / Search: SRCH
import { test } from "node:test";
import assert from "node:assert/strict";
import srch, { BOND_UNIVERSE, lookupBond } from "../lib/fn/srch.js";

test("SRCH: returns full expanded OSBAP universe with pricing metrics", async () => {
  const res = await srch({});
  assert.ok(res.total >= 50); // Expanded institutional universe
  assert.equal(res.universeSize, BOND_UNIVERSE.length);
  assert.equal(res.rows.length, res.total);

  // Check structure of first row
  const r0 = res.rows[0];
  assert.ok(r0.id);
  assert.ok(r0.issuer);
  assert.ok(r0.cleanPrice > 0);
  assert.ok(r0.ytm > 0);
  assert.match(res.source, /Open Source Bond Asset Pricing/);
});

test("SRCH: filters by keyword (ticker, issuer, or CUSIP)", async () => {
  const resApple = await srch({ q: "Apple" });
  assert.ok(resApple.total >= 2);
  assert.ok(resApple.rows.every((r) => r.issuer.includes("Apple")));

  const resCusip = await srch({ q: "594918BW7" });
  assert.equal(resCusip.total, 1);
  assert.equal(resCusip.rows[0].issuer, "Microsoft Corp.");
  assert.equal(resCusip.rows[0].cusip, "594918BW7");
});

test("SRCH: filters across multiple GICS sectors", async () => {
  const resTech = await srch({ sector: "technology" });
  assert.ok(resTech.total >= 5);
  assert.ok(resTech.rows.every((r) => r.sector === "Technology"));

  const resFin = await srch({ sector: "finance" });
  assert.ok(resFin.total >= 5);
  assert.ok(resFin.rows.every((r) => r.sector === "Finance"));

  const resEnergy = await srch({ sector: "energy" });
  assert.ok(resEnergy.total >= 5);
  assert.ok(resEnergy.rows.every((r) => r.sector === "Energy"));

  const resHealth = await srch({ sector: "healthcare" });
  assert.ok(resHealth.total >= 5);
  assert.ok(resHealth.rows.every((r) => r.sector === "Healthcare"));

  const resUtils = await srch({ sector: "utilities" });
  assert.ok(resUtils.total >= 4);
  assert.ok(resUtils.rows.every((r) => r.sector === "Utilities"));
});

test("SRCH: dynamic lookup resolves any valid 9-character CUSIP", async () => {
  const resCustom = await srch({ q: "123456AB7" });
  assert.equal(resCustom.total, 1);
  assert.equal(resCustom.rows[0].cusip, "123456AB7");
  assert.ok(resCustom.rows[0].cleanPrice > 0);
  assert.ok(resCustom.rows[0].ytm > 0);
});

test("SRCH: lookupBond finds bonds by CUSIP or ID", () => {
  const b1 = lookupBond("68389XBT8"); // Oracle
  assert.ok(b1);
  assert.equal(b1.issuer, "Oracle Corp.");

  const b2 = lookupBond("US3M"); // US 3M Bill
  assert.ok(b2);
  assert.equal(b2.type, "govt");
});
