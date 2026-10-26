import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PROMO_REPORT_PRICE, REPORT_LIST_PRICE, currentReportPrice, isPromoActive, won } from "./pricing.ts";

const at = (s: string) => new Date(s);

test("11월 한정 990원: 경계 시각(한국 시간)", () => {
  assert.equal(currentReportPrice(at("2026-10-31T23:59:59+09:00")), 1900);
  assert.equal(currentReportPrice(at("2026-11-01T00:00:00+09:00")), 990);
  assert.equal(currentReportPrice(at("2026-11-30T23:59:59+09:00")), 990);
  assert.equal(currentReportPrice(at("2026-12-01T00:00:00+09:00")), 1900);
  assert.equal(isPromoActive(at("2026-11-15T12:00:00+09:00")), true);
  assert.equal(isPromoActive(at("2027-11-15T12:00:00+09:00")), false);
});

test("화면 문구는 금액을 직접 쓰지 않고 {price}/{list} 자리로 채운다(화면만 옛 금액으로 남는 일 방지)", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
  const r = data.copy.result;
  for (const k of ["paywall_price", "paywall_button", "paywall_price_promo"]) {
    assert.match(String(r[k]), /\{price\}/, k);
    assert.doesNotMatch(String(r[k]), /\d{1,3}(,\d{3})*원/, k);
  }
  assert.match(String(data.copy.intro.promo_banner), /\{price\}/);
  assert.equal(won(REPORT_LIST_PRICE), "1,900원");
  assert.equal(won(PROMO_REPORT_PRICE), "990원");
});
