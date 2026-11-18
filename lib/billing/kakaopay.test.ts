import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAfterKakaoApproveFailure, kakaoReturnOrigin, kakaopayEnabled, pickKakaoRedirect } from "./kakaopay.ts";

test("CID와 Secret key가 둘 다 있어야 켜진다", () => {
  assert.equal(kakaopayEnabled({}), false);
  assert.equal(kakaopayEnabled({ KAKAOPAY_CID: "TC0ONETIME" }), false);
  assert.equal(kakaopayEnabled({ KAKAOPAY_CID: " ", KAKAOPAY_SECRET_KEY: "x" }), false);
  assert.equal(kakaopayEnabled({ KAKAOPAY_CID: "TC0ONETIME", KAKAOPAY_SECRET_KEY: "x" }), true);
});

test("휴대폰은 모바일 주소, PC는 PC 주소, https만", () => {
  const r = { next_redirect_mobile_url: "https://m.kakao/x", next_redirect_pc_url: "https://pc.kakao/x" };
  assert.equal(pickKakaoRedirect("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", r), "https://m.kakao/x");
  assert.equal(pickKakaoRedirect("Mozilla/5.0 (Windows NT 10.0)", r), "https://pc.kakao/x");
  assert.equal(pickKakaoRedirect("Windows", { next_redirect_pc_url: "javascript:alert(1)" }), null);
  assert.equal(pickKakaoRedirect("Windows", {}), null);
});

test("돌아올 주소는 우리 사이트만", () => {
  const fb = "https://tarot.ssolwellnesshouse.com";
  assert.equal(kakaoReturnOrigin("https://tarot.ssolwellnesshouse.com", fb), fb);
  assert.equal(kakaoReturnOrigin("http://localhost:3200", fb), "http://localhost:3200");
  assert.equal(kakaoReturnOrigin("https://x-git-y.vercel.app", fb), "https://x-git-y.vercel.app");
  assert.equal(kakaoReturnOrigin("https://evil.example", fb), fb);
  assert.equal(kakaoReturnOrigin("http://tarot.ssolwellnesshouse.com", fb), fb);
  assert.equal(kakaoReturnOrigin(null, fb), fb);
  assert.equal(kakaoReturnOrigin("not a url", fb), fb);
});

test("승인 실패 뒤 판단: 결제 완료면 paid, 결제 안 됨이면 cancel, 모르면 retry", () => {
  const e = { orderId: "o1", amount: 990 };
  assert.equal(decideAfterKakaoApproveFailure({ status: "SUCCESS_PAYMENT", partnerOrderId: "o1", total: 990 }, e), "paid");
  assert.equal(decideAfterKakaoApproveFailure({ status: "SUCCESS_PAYMENT", partnerOrderId: "o2", total: 990 }, e), "retry");
  assert.equal(decideAfterKakaoApproveFailure({ status: "SUCCESS_PAYMENT", partnerOrderId: "o1", total: 1900 }, e), "retry");
  assert.equal(decideAfterKakaoApproveFailure({ status: "QUIT_PAYMENT", partnerOrderId: "o1", total: 990 }, e), "cancel");
  assert.equal(decideAfterKakaoApproveFailure({ status: "PART_CANCEL_PAYMENT", partnerOrderId: "o1", total: 990 }, e), "retry");
  assert.equal(decideAfterKakaoApproveFailure(null, e), "retry");
});
