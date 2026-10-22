import { test } from "node:test";
import assert from "node:assert/strict";
import { decideAfterConfirmFailure } from "./confirmDecision.ts";

const exp = { orderId: "o1", amount: 1900 };
const L = (status: string, orderId: string | null = "o1", totalAmount: number | null = 1900) => ({ status, orderId, totalAmount, method: "카드" });

test("승인 응답을 못 받아도 토스에서 DONE이고 주문·금액이 맞으면 결제 완료로", () => {
  assert.equal(decideAfterConfirmFailure(L("DONE"), exp), "paid");
});
test("DONE인데 주문이나 금액이 다르면 손대지 않음(다시 시도·고객센터)", () => {
  assert.equal(decideAfterConfirmFailure(L("DONE", "other"), exp), "retry");
  assert.equal(decideAfterConfirmFailure(L("DONE", "o1", 100), exp), "retry");
});
test("상태를 물어보지 못하면 취소하지 않는다(돈이 나갔을 수 있음)", () => {
  assert.equal(decideAfterConfirmFailure(null, exp), "retry");
  assert.equal(decideAfterConfirmFailure(L("SOMETHING_NEW"), exp), "retry");
});
test("승인되지 않은 것이 확실하면 취소", () => {
  for (const s of ["ABORTED", "EXPIRED", "CANCELED", "IN_PROGRESS", "READY", "NOT_FOUND"]) assert.equal(decideAfterConfirmFailure(L(s), exp), "cancel", s);
});
