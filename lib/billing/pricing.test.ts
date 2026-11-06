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
import { REPORT_PRICE_USD, currencyForLocale, reportPriceFor, toMajor, toMinor, tossKeyKind, tossKeysFor, tossSecretFor, usd, usdCheckoutEnabled } from "./pricing.ts";
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
test("달러 결제는 달러 상점의 두 키가 다 있을 때만 열린다(원화 키로 대신하지 않음)", () => {
  assert.equal(usdCheckoutEnabled({}), false);
  assert.equal(usdCheckoutEnabled({ TOSS_SECRET_KEY: "ko", NEXT_PUBLIC_TOSS_CLIENT_KEY: "kc" }), false);
  assert.equal(usdCheckoutEnabled({ TOSS_SECRET_KEY_USD: "us" }), false);
  assert.equal(usdCheckoutEnabled({ TOSS_SECRET_KEY_USD: "us", TOSS_CLIENT_KEY_USD: "uc" }), true);
  assert.equal(usdCheckoutEnabled({ TOSS_EN_SECRET_KEY: "es", NEXT_PUBLIC_TOSS_EN_CLIENT_KEY: "ec" }), true); // 예전 이름(같은 통화)
});
test("통화별 키: 새 이름 우선, 없으면 같은 통화의 예전 이름만 — 다른 통화로는 절대 안 넘어감(2003 방지)", () => {
  const env = { TOSS_CLIENT_KEY_KRW: "kc", TOSS_SECRET_KEY_KRW: "ks", NEXT_PUBLIC_TOSS_CLIENT_KEY: "old-kc", TOSS_SECRET_KEY: "old-ks" };
  assert.deepEqual(tossKeysFor("KRW", env), { clientKey: "kc", secretKey: "ks" });
  assert.deepEqual(tossKeysFor("USD", env), { clientKey: null, secretKey: null });
  assert.deepEqual(tossKeysFor("KRW", { NEXT_PUBLIC_TOSS_CLIENT_KEY: "old-kc", TOSS_SECRET_KEY: "old-ks" }), { clientKey: "old-kc", secretKey: "old-ks" });
  assert.deepEqual(tossKeysFor("USD", { TOSS_CLIENT_KEY_USD: "uc", TOSS_SECRET_KEY_USD: "us", NEXT_PUBLIC_TOSS_EN_CLIENT_KEY: "ec", TOSS_EN_SECRET_KEY: "es" }), { clientKey: "uc", secretKey: "us" });
  assert.equal(tossSecretFor("USD", { TOSS_SECRET_KEY: "ko" }), null);
  assert.equal(tossSecretFor("KRW", { TOSS_SECRET_KEY_USD: "us" }), null);
  assert.equal(currencyForLocale("en"), "USD");
  assert.equal(currencyForLocale("ko"), "KRW");
});
test("영문 결제창 키 종류", () => {
  assert.equal(tossKeyKind("live_gck_x"), "widget");
  assert.equal(tossKeyKind("live_ck_x"), "api");
  assert.equal(tossKeyKind(undefined), null);
  assert.equal(tossKeyKind("weird"), null);
});
