import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PROMO_REPORT_PRICE, REPORT_LIST_PRICE, currentReportPrice, isPromoActive, won } from "./pricing.ts";

const at = (s: string) => new Date(s);

test("할인 990원(2026-10-26 ~ 11-30): 경계 시각(한국 시간)", () => {
  assert.equal(currentReportPrice(at("2026-10-25T23:59:59+09:00")), 1900);
  assert.equal(currentReportPrice(at("2026-10-26T00:00:00+09:00")), 990);
  assert.equal(currentReportPrice(at("2026-10-31T12:00:00+09:00")), 990);
  assert.equal(currentReportPrice(at("2026-11-30T23:59:59+09:00")), 990);
  assert.equal(currentReportPrice(at("2026-12-01T00:00:00+09:00")), 1900);
  assert.equal(isPromoActive(at("2026-11-15T12:00:00+09:00")), true);
  assert.equal(isPromoActive(at("2027-11-15T12:00:00+09:00")), false);
});

test("화면 문구는 금액을 직접 쓰지 않고 {price}/{list} 자리로 채운다(화면만 옛 금액으로 남는 일 방지)", () => {
  const data = JSON.parse(fs.readFileSync(new URL("../../data/tarot_data.json", import.meta.url), "utf8"));
  const r = data.copy.result;
  for (const k of ["paywall_price", "paywall_button"]) {
    assert.match(String(r[k]), /\{price\}/, k);
    assert.doesNotMatch(String(r[k]), /\d{1,3}(,\d{3})*원/, k);
  }
  assert.equal(won(REPORT_LIST_PRICE), "1,900원");
  assert.equal(won(PROMO_REPORT_PRICE), "990원");
});

// 영문판 결제(2026-11-06): US$1.99, 할인 없음, 주문 표에는 센트로
import { REPORT_PRICE_USD, reportPriceFor, toMajor, toMinor, tossKeyKind, tossSecretFor, usd, usdCheckoutEnabled } from "./pricing.ts";
test("영문 가격은 US$1.99이고 할인 기간에도 그대로", () => {
  assert.deepEqual(reportPriceFor("en", new Date("2026-11-10T12:00:00+09:00")), { currency: "USD", amount: REPORT_PRICE_USD, label: "US$1.99" });
  assert.equal(reportPriceFor("ko", new Date("2026-11-10T12:00:00+09:00")).label, "990원");
  assert.equal(usd(1.99), "US$1.99");
});
test("달러는 센트로 저장하고 토스 금액과 맞춰 본다(원화는 그대로)", () => {
  assert.equal(toMinor("USD", 1.99), 199);
  assert.equal(toMinor("USD", Number("1.99")), 199);
  assert.equal(toMajor("USD", 199), 1.99);
  assert.equal(toMinor("KRW", 990), 990);
  assert.equal(toMajor("KRW", 990), 990);
});
test("영문 결제는 TAROT_USD_CHECKOUT=1이고 해외결제 상점 비밀 키가 있을 때만 열린다(원화 키로 대신하지 않음)", () => {
  assert.equal(usdCheckoutEnabled({}), false);
  assert.equal(usdCheckoutEnabled({ TAROT_USD_CHECKOUT: "1" }), false);
  assert.equal(usdCheckoutEnabled({ TAROT_USD_CHECKOUT: "1", TOSS_SECRET_KEY: "ko" }), false);
  assert.equal(usdCheckoutEnabled({ TAROT_USD_CHECKOUT: "true", TOSS_EN_SECRET_KEY: "en" }), false);
  assert.equal(usdCheckoutEnabled({ TAROT_USD_CHECKOUT: "1", TOSS_EN_SECRET_KEY: "en" }), true);
});
test("상점별 비밀 키: 영문은 TOSS_EN_SECRET_KEY만, 한국어는 TOSS_SECRET_KEY만(2003 방지)", () => {
  assert.equal(tossSecretFor("en", { TOSS_SECRET_KEY: "ko" }), null);
  assert.equal(tossSecretFor("en", { TOSS_SECRET_KEY: "ko", TOSS_EN_SECRET_KEY: "en" }), "en");
  assert.equal(tossSecretFor("ko", { TOSS_SECRET_KEY: "ko", TOSS_EN_SECRET_KEY: "en" }), "ko");
  assert.equal(tossSecretFor("ko", { TOSS_EN_SECRET_KEY: "en" }), null);
});
test("영문 결제창 키 종류", () => {
  assert.equal(tossKeyKind("live_gck_x"), "widget");
  assert.equal(tossKeyKind("live_ck_x"), "api");
  assert.equal(tossKeyKind(undefined), null);
  assert.equal(tossKeyKind("weird"), null);
});
