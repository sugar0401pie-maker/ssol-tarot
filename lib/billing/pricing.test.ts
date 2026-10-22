import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { REPORT_PRICE, reportPriceLabel } from "./pricing.ts";

test("결제 금액과 화면 문구의 금액이 같다(화면만 옛 금액으로 남는 일 방지)", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
  assert.equal(REPORT_PRICE, 1900);
  const r = data.copy.result;
  for (const k of ["paywall_price", "paywall_button"]) {
    const amounts = String(r[k] ?? "").match(/\d{1,3}(,\d{3})*원/g) ?? [];
    for (const a of amounts) assert.equal(a, reportPriceLabel(), `${k}: ${a}`);
  }
});
