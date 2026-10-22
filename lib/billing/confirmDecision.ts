// 결제 승인 실패 뒤 무엇을 할지 정하는 순수 함수(서버 결제 확정 경로, 테스트 있음).
// 원칙: 돈이 나갔을 수 있으면 절대 '취소'로 바꾸지 않는다. 토스에 실제 상태를 물어
//   DONE이고 주문·금액이 맞으면 → 결제 완료 처리, 확실히 승인되지 않은 상태면 → 주문 취소, 알 수 없으면 → 그대로 두고 다시 시도 안내.
export interface TossLookup {
  status: string;
  orderId: string | null;
  totalAmount: number | null;
  method: string | null;
}

export type ConfirmDecision = "paid" | "cancel" | "retry";

/** 토스가 결제를 승인하지 않은 것이 확실한 상태(이 상태면 카드에서 돈이 나가지 않았거나 이미 되돌려짐). */
const NOT_APPROVED = new Set(["READY", "IN_PROGRESS", "WAITING_FOR_DEPOSIT", "ABORTED", "EXPIRED", "CANCELED", "PARTIAL_CANCELED", "NOT_FOUND"]);

export function decideAfterConfirmFailure(lookup: TossLookup | null, expected: { orderId: string; amount: number }): ConfirmDecision {
  if (!lookup) return "retry";
  if (lookup.status === "DONE") return lookup.orderId === expected.orderId && lookup.totalAmount === expected.amount ? "paid" : "retry";
  // IN_PROGRESS(인증만 되고 승인 전)·READY는 승인 요청이 실패했으니 돈이 나가지 않았다
  return NOT_APPROVED.has(lookup.status) ? "cancel" : "retry";
}
