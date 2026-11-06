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
import { REPORT_PRICE_USD, currencyForLocale, reportPriceFor, toMajor, toMinor, tossKeyKind, tossKeysFor, tossSecretFor, usd, usdCheckoutEnabled, variantKeyFor } from "./pricing.ts";
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
test("결제위젯 키 한 벌로 두 MID: 원화·달러 모두 같은 키 세트, MID는 variantKey로(owner 정정 2026-11-06)", () => {
  const env = { NEXT_PUBLIC_TOSS_CLIENT_KEY: "live_gck_x", TOSS_SECRET_KEY: "live_gsk_x" };
  assert.deepEqual(tossKeysFor("KRW", env), { clientKey: "live_gck_x", secretKey: "live_gsk_x" });
  assert.deepEqual(tossKeysFor("USD", env), { clientKey: "live_gck_x", secretKey: "live_gsk_x" });
  assert.equal(variantKeyFor("KRW", env), "DEFAULT");
  assert.equal(variantKeyFor("USD", env), "dollar.only");
  assert.equal(usdCheckoutEnabled(env), true);
  assert.equal(usdCheckoutEnabled({}), false);
});
test("예전 달러 전용 이름(API 개별 연동 키가 남아 있던 곳)은 읽지 않는다 — 결제위젯 키와 엇갈림 방지", () => {
  const env = { NEXT_PUBLIC_TOSS_CLIENT_KEY: "live_gck_x", TOSS_SECRET_KEY: "live_gsk_x", NEXT_PUBLIC_TOSS_EN_CLIENT_KEY: "live_ck_old", TOSS_EN_SECRET_KEY: "live_sk_old" };
  assert.deepEqual(tossKeysFor("USD", env), { clientKey: "live_gck_x", secretKey: "live_gsk_x" });
});
test("달러 전용 키는 두 개가 다 있을 때만 쓴다(짝이 어긋나지 않게)", () => {
  const base = { TOSS_CLIENT_KEY_KRW: "kc", TOSS_SECRET_KEY_KRW: "ks" };
  assert.deepEqual(tossKeysFor("USD", { ...base, TOSS_CLIENT_KEY_USD: "uc" }), { clientKey: "kc", secretKey: "ks" });
  assert.deepEqual(tossKeysFor("USD", { ...base, TOSS_CLIENT_KEY_USD: "uc", TOSS_SECRET_KEY_USD: "us" }), { clientKey: "uc", secretKey: "us" });
  assert.deepEqual(tossKeysFor("KRW", { ...base, TOSS_CLIENT_KEY_USD: "uc", TOSS_SECRET_KEY_USD: "us" }), { clientKey: "kc", secretKey: "ks" });
  assert.equal(tossSecretFor("USD", { TOSS_SECRET_KEY: "ks" }), "ks");
  assert.equal(currencyForLocale("en"), "USD");
  assert.equal(currencyForLocale("ko"), "KRW");
});
test("영문 결제창 키 종류", () => {
  assert.equal(tossKeyKind("live_gck_x"), "widget");
  assert.equal(tossKeyKind("live_ck_x"), "api");
  assert.equal(tossKeyKind(undefined), null);
  assert.equal(tossKeyKind("weird"), null);
});
