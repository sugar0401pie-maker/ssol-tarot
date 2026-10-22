import { NextResponse, after } from "next/server";
import { confirmPayment, generateReport } from "@/lib/server/session";
import { authFrom, fail, readJson } from "@/lib/server/http";

// 토스 결제창에서 돌아온 값(paymentKey·orderId·amount)을 그대로 믿지 않는다:
// ① 내 주문·처리 전·금액 일치 확인 → ② 시크릿 키로 토스에 승인 요청 → ③ 승인됐을 때만 결제 완료 처리.
// 승인 뒤 유료 리포트(D·E, 수십 초)는 응답을 먼저 보낸 다음 after()로 만든다 — 화면은 결과 페이지에서 기다린다.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { userId } = await authFrom(req);
    const r = await confirmPayment(userId, await readJson(req));
    if (r.generate) after(() => generateReport(r.sessionId));
    return NextResponse.json({ ok: true, sessionId: r.sessionId });
  } catch (e) {
    return fail(e);
  }
}
