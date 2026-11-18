import "server-only";

// 카카오페이 단건 결제 API(직접 계약, owner 2026-11-18): 준비(ready) → 승인(approve) → 조회(order) / 취소(cancel).
// Secret key·CID는 Vercel 환경 변수(KAKAOPAY_SECRET_KEY·KAKAOPAY_CID)에만 — 서버에서만 읽고 로그·응답에 넣지 않는다.
// 테스트: CID "TC0ONETIME" + 개발용 Secret key(dev). 운영: 발급받은 CID + 운영 Secret key.
import { createHmac } from "node:crypto";
import type { KakaoOrderLookup } from "@/lib/billing/kakaopay";

const HOST = "https://open-api.kakaopay.com/online/v1/payment";
const cid = () => process.env.KAKAOPAY_CID?.trim() || "";
const key = () => process.env.KAKAOPAY_SECRET_KEY?.trim() || "";

/** 카카오페이에 보내는 사용자 표시 — 계정 id 대신 요약값(개인정보를 넘기지 않음). 준비·승인에 같은 값이어야 한다. */
export function kakaoUserRef(userId: string): string {
  const secret = process.env.TAROT_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "tarot";
  return `u_${createHmac("sha256", secret).update(`kakaopay:${userId}`).digest("hex").slice(0, 24)}`;
}

type Res<T> = { ok: true; body: T } | { ok: false; code: string | null; message: string; network: boolean };

async function call<T>(path: string, payload: Record<string, unknown>, timeoutMs = 15000): Promise<Res<T>> {
  if (!cid() || !key()) return { ok: false, code: "NO_KEY", message: "카카오페이 결제가 아직 설정되지 않았어요.", network: false };
  try {
    const res = await fetch(`${HOST}/${path}`, {
      method: "POST",
      headers: { Authorization: `SECRET_KEY ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cid: cid(), ...payload }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const code = body?.error_code != null ? String(body.error_code) : null;
      return { ok: false, code, message: body?.error_message ?? `카카오페이 요청에 실패했어요 (${res.status}).`, network: res.status >= 500 };
    }
    return { ok: true, body: body as T };
  } catch (e) {
    return { ok: false, code: null, message: e instanceof Error ? e.message : "카카오페이 요청 중 오류가 발생했어요.", network: true };
  }
}

export type KakaoReady = { tid: string; next_redirect_mobile_url?: string; next_redirect_pc_url?: string; next_redirect_app_url?: string };

export function kakaoReady(p: { orderId: string; userRef: string; itemName: string; amount: number; approvalUrl: string; cancelUrl: string; failUrl: string }) {
  return call<KakaoReady>("ready", {
    partner_order_id: p.orderId,
    partner_user_id: p.userRef,
    item_name: p.itemName,
    quantity: 1,
    total_amount: p.amount,
    tax_free_amount: 0,
    approval_url: p.approvalUrl,
    cancel_url: p.cancelUrl,
    fail_url: p.failUrl,
  });
}

export type KakaoApprove = { tid: string; partner_order_id: string; payment_method_type?: string; amount?: { total?: number } };

export function kakaoApprove(p: { tid: string; orderId: string; userRef: string; pgToken: string }) {
  return call<KakaoApprove>("approve", { tid: p.tid, partner_order_id: p.orderId, partner_user_id: p.userRef, pg_token: p.pgToken }, 20000);
}

/** 결제 한 건의 실제 상태. 못 물어보면 null. */
export async function kakaoOrder(tid: string): Promise<KakaoOrderLookup> {
  const r = await call<{ status?: string; partner_order_id?: string; amount?: { total?: number } }>("order", { tid });
  if (!r.ok) return null;
  return { status: String(r.body.status ?? ""), partnerOrderId: r.body.partner_order_id ?? null, total: typeof r.body.amount?.total === "number" ? r.body.amount.total : null };
}

/** 승인된 결제 전액 취소(같은 결과 중복 결제·금액 불일치). 성공하면 true. */
export async function kakaoCancel(tid: string, amount: number): Promise<boolean> {
  const r = await call("cancel", { tid, cancel_amount: amount, cancel_tax_free_amount: 0 });
  return r.ok;
}
