// 카카오페이 단건 결제(직접 계약, owner 2026-11-18) — 서버·화면이 함께 쓰는 순수 함수(네트워크·키 없음, 테스트 있음).
// 실제 API 호출은 lib/server/kakaopay.ts(서버 전용). 토스 결제위젯과 별개로 결제 화면에 [카카오페이로 결제] 버튼을 따로 둔다.

export const KAKAOPAY_METHOD = "카카오페이"; // tarot_orders.method에 남는 이름(관리자 엑셀에 그대로)

/** CID와 Secret key가 둘 다 있을 때만 켠다 — 없으면 버튼을 보이지 않고 주문도 만들지 않는다. */
export function kakaopayEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.KAKAOPAY_CID?.trim() && env.KAKAOPAY_SECRET_KEY?.trim());
}

/** 카카오페이 결제 화면 주소 고르기: 휴대폰 브라우저면 모바일 주소(카카오톡 앱으로 이어짐), 아니면 PC 주소(QR). */
export function pickKakaoRedirect(userAgent: string, r: { next_redirect_mobile_url?: string | null; next_redirect_pc_url?: string | null }): string | null {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  const url = mobile ? r.next_redirect_mobile_url || r.next_redirect_pc_url : r.next_redirect_pc_url || r.next_redirect_mobile_url;
  return url && /^https:\/\//.test(url) ? url : null;
}

/**
 * 카카오페이가 결제 뒤 돌려보낼 주소의 앞부분. 요청 주소를 그대로 믿지 않고(Host 헤더 위조 방지)
 * 우리 사이트·로컬·Vercel 미리보기만 허용, 그 밖이면 기본 사이트 주소.
 */
export function kakaoReturnOrigin(reqOrigin: string | null, fallback: string): string {
  try {
    if (!reqOrigin) return fallback;
    const u = new URL(reqOrigin);
    const ok =
      (u.protocol === "https:" && (u.hostname === "tarot.ssolwellnesshouse.com" || u.hostname.endsWith(".vercel.app"))) ||
      (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"));
    return ok ? u.origin : fallback;
  } catch {
    return fallback;
  }
}

// 카카오페이 결제 상태(주문 조회 API의 status)
const PAID = new Set(["SUCCESS_PAYMENT"]);
const NOT_PAID = new Set(["READY", "SEND_TMS", "OPEN_PAYMENT", "SELECT_METHOD", "ARS_WAITING", "AUTH_PASSWORD", "ISSUED_SID", "CANCEL_PAYMENT", "FAIL_AUTH_PASSWORD", "QUIT_PAYMENT", "FAIL_PAYMENT"]);

export type KakaoOrderLookup = { status: string; partnerOrderId: string | null; total: number | null } | null;

/**
 * 승인(approve) 응답이 실패였을 때 실제 상태로 다시 판단(토스 decideAfterConfirmFailure와 같은 원칙):
 * 결제 완료 + 주문 번호·금액 일치면 "paid", 확실히 결제 안 됨이면 "cancel", 모르면 "retry"(돈이 나갔을 수 있으면 절대 취소로 바꾸지 않음).
 */
export function decideAfterKakaoApproveFailure(lookup: KakaoOrderLookup, expect: { orderId: string; amount: number }): "paid" | "cancel" | "retry" {
  if (!lookup) return "retry";
  if (PAID.has(lookup.status)) {
    return lookup.partnerOrderId === expect.orderId && lookup.total === expect.amount ? "paid" : "retry";
  }
  if (NOT_PAID.has(lookup.status)) return "cancel";
  return "retry"; // 부분 취소 등 예상 밖 상태는 사람이 확인
}
