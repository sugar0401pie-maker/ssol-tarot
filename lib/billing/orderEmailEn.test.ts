import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrderEmailEn, formatPaidAt, isEmail, methodLabel } from "./orderEmailEn.ts";

test("주문 확인 이메일: 08 §4 문구(주문 번호·가격·결제 시각·수단·철회권 확인·판매자·약관 링크)", () => {
  const m = buildOrderEmailEn({ orderId: "ord-1", paidAt: new Date("2026-11-06T09:05:00Z"), method: "카드", resultId: "r1" });
  assert.equal(m.subject, "Your SSOL Tarot House full report — order confirmation");
  assert.ok(m.text.includes("Order no. ord-1 · Full tarot report · US$1.99, one-time payment, no renewal · Paid on November 6, 2026, 09:05 UTC with card."));
  assert.ok(m.text.includes("you lose your right to cancel once it is shown to you"));
  assert.ok(m.text.includes("572-07-03549") && m.text.includes("/en/legal#terms") && m.text.includes("/en/legal#refund"));
  assert.ok(m.text.includes("https://en.tarot.ssolwellnesshouse.com/en/result/r1/4"));
  assert.ok(!/[가-힣]/.test(m.text) && !/[가-힣]/.test(m.html));
});

test("결제수단·시각·이메일 검사", () => {
  assert.equal(methodLabel("해외간편결제"), "PayPal");
  assert.equal(methodLabel(null), "card or PayPal");
  assert.equal(formatPaidAt(new Date("2026-01-02T23:59:00Z")), "January 2, 2026, 23:59 UTC");
  assert.ok(isEmail("a@b.co") && !isEmail("nope") && !isEmail(""));
});

test("카드 그림·이름·닉네임은 HTML에 들어가고(이스케이프), 없으면 자리 안 잡음", () => {
  const withArt = buildOrderEmailEn({ orderId: "o", paidAt: new Date("2026-11-06T09:05:00Z"), method: "카드", resultId: "r", imageUrl: "https://x/a.jpg", cardName: "The Embrace", nickname: "Jamie<b>" });
  assert.ok(withArt.html.includes('src="https://x/a.jpg"') && withArt.html.includes("THE EMBRACE · THE KEY AHEAD") && withArt.html.includes("Jamie&lt;b&gt;, thanks for your order."));
  const bare = buildOrderEmailEn({ orderId: "o", paidAt: new Date(), method: null, resultId: null });
  assert.ok(!bare.html.includes("<img") && !bare.html.includes("Open your report"));
});
