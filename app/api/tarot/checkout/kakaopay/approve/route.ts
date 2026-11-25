import { NextResponse, after } from "next/server";
import { generateReport, kakaopayApproveOrder } from "@/lib/server/session";
import { authFrom, fail, readJson } from "@/lib/server/http";
import { sendXPurchase } from "@/lib/server/xCapi";

// 카카오페이 결제 승인(owner 2026-11-18): 카카오페이가 돌려준 pg_token으로 서버가 승인 → 금액 확인 → 결제 완료.
// 승인 뒤 유료 리포트는 응답을 먼저 보낸 다음 after()로 만든다(토스 확인 라우트와 같음).
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const auth = await authFrom(req); // 계정 또는 결과 접근 키(로그인 없이 결제)
    const r = await kakaopayApproveOrder(auth, await readJson(req));
    if (r.generate) after(() => generateReport(r.sessionId));
    // X 전환 API(owner 2026-11-25) — 처음 결제 완료될 때 한 번
    const paid = "paidOrder" in r ? r.paidOrder : null;
    if (paid) after(() => sendXPurchase(req, paid));
    return NextResponse.json({ ok: true, sessionId: r.sessionId, amount: "amount" in r ? r.amount : null });
  } catch (e) {
    return fail(e, req);
  }
}
