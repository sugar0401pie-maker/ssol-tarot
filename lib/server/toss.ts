import "server-only";

// 토스페이먼츠 결제 승인(confirm)·조회·취소 API를 직접 호출하는 작은 헬퍼. 시크릿 키는 여기(서버)에서만
// 쓰고, Basic 인증 형식(시크릿키 뒤에 콜론만 붙여 base64)은 토스 공식 문서 그대로다.
// 절대 클라이언트로 시크릿 키가 넘어가면 안 된다 — TOSS_SECRET_KEY는 NEXT_PUBLIC_이 아니다.
import type { TossLookup } from "@/lib/billing/confirmDecision";

export type TossConfirmResult =
  | { ok: true; totalAmount: number; method: string | null }
  // network: 토스까지 닿지 못했거나 응답을 못 읽음 — 토스에서는 승인됐을 수도 있다(그래서 바로 취소하지 않는다)
  | { ok: false; error: string; code: string | null; network: boolean };

function authHeader(): string | null {
  const secretKey = process.env.TOSS_SECRET_KEY;
  return secretKey ? `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}` : null;
}

export async function confirmTossPayment(params: { paymentKey: string; orderId: string; amount: number }): Promise<TossConfirmResult> {
  const auth = authHeader();
  if (!auth) return { ok: false, error: "결제 연동이 아직 설정되지 않았어요.", code: "NO_KEY", network: false };
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // 5xx는 토스 쪽 처리 결과를 알 수 없으므로 network와 같게 본다
      return { ok: false, error: body?.message ?? `토스 결제 승인에 실패했어요 (${res.status}).`, code: body?.code ?? null, network: res.status >= 500 };
    }
    return { ok: true, totalAmount: body.totalAmount, method: body.method ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "결제 승인 중 오류가 발생했어요.", code: null, network: true };
  }
}

/** 결제 한 건의 실제 상태(승인 응답을 못 받았거나 '이미 처리됨'일 때 확인용). 못 물어보면 null. */
export async function getTossPayment(paymentKey: string): Promise<TossLookup | null> {
  const auth = authHeader();
  if (!auth) return null;
  try {
    const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, { headers: { authorization: auth } });
    if (res.status === 404) return { status: "NOT_FOUND", orderId: null, totalAmount: null, method: null };
    if (!res.ok) return null;
    const b = await res.json();
    return { status: String(b.status ?? ""), orderId: b.orderId ?? null, totalAmount: typeof b.totalAmount === "number" ? b.totalAmount : null, method: b.method ?? null };
  } catch {
    return null;
  }
}

/** 승인된 결제를 전액 취소(같은 결과를 두 번 결제한 경우 등). 성공하면 true. */
export async function cancelTossPayment(paymentKey: string, reason: string): Promise<boolean> {
  const auth = authHeader();
  if (!auth) return false;
  try {
    const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
      method: "POST",
      headers: { authorization: auth, "content-type": "application/json", "Idempotency-Key": `cancel-${paymentKey}` },
      body: JSON.stringify({ cancelReason: reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
