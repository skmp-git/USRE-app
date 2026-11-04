// Tests for Fixed Income & Corporate Bond Screener / Search: SRCH
import { test } from "node:test";
import assert from "node:assert/strict";
import srch, { BOND_UNIVERSE } from "../lib/fn/srch.js";

test("SRCH: returns full universe with pricing metrics when no filter applied", async () => {
  const res = await srch({});
  assert.ok(res.total >= 20);
  assert.equal(res.universeSize, BOND_UNIVERSE.length);
  assert.equal(res.rows.length, res.total);

  // Check structure of first row
  const r0 = res.rows[0];
  assert.ok(r0.id);
  assert.ok(r0.issuer);
  assert.ok(r0.cleanPrice > 0);
  assert.ok(r0.ytm > 0);
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

test("SRCH: filters by sector and rating grade", async () => {
  const resTech = await srch({ sector: "technology" });
  assert.ok(resTech.total >= 4);
  assert.ok(resTech.rows.every((r) => r.sector === "Technology"));

  const resIg = await srch({ ratingGrade: "ig" });
  assert.ok(resIg.total >= 10);
  assert.ok(resIg.rows.every((r) => r.ratingGrade === "Investment Grade"));

  const resHy = await srch({ ratingGrade: "hy" });
  assert.ok(resHy.total >= 2);
  assert.ok(resHy.rows.every((r) => r.ratingGrade === "High Yield"));
});

test("SRCH: filters by coupon and maturity ranges", async () => {
  const resMat = await srch({ yearsMin: "4", yearsMax: "6" });
  assert.ok(resMat.total > 0);
  assert.ok(resMat.rows.every((r) => r.years >= 4 && r.years <= 6));

  const resCoupon = await srch({ couponMin: "4.0", couponMax: "5.0" });
  assert.ok(resCoupon.total > 0);
  assert.ok(resCoupon.rows.every((r) => r.coupon >= 4.0 && r.coupon <= 5.0));
});

test("SRCH: sorts rows by specified field and direction", async () => {
  const resAsc = await srch({ sort: "years", dir: "asc" });
  for (let i = 0; i < resAsc.rows.length - 1; i++) {
    assert.ok(resAsc.rows[i].years <= resAsc.rows[i + 1].years);
  }

  const resDesc = await srch({ sort: "coupon", dir: "desc" });
  for (let i = 0; i < resDesc.rows.length - 1; i++) {
    assert.ok(resDesc.rows[i].coupon >= resDesc.rows[i + 1].coupon);
  }
});
