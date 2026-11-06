import { NextResponse, after } from "next/server";
import { createOrder, generateReport, loadSession } from "@/lib/server/session";
import { fail, readJson } from "@/lib/server/http";
import { getAuthUser } from "@/lib/server/supabaseAdmin";

// 결제 주문 만들기(로그인한 본인 결과만): 아직 결제 전인지 확인하고 금액은 서버가 정한다. 돌려준 orderId로 토스 결제창을 연다.
export const runtime = "nodejs";
// 무료 열람 계정은 이 요청 뒤에 리포트를 만든다(결제 확인과 같은 한도 — app/api/tarot/checkout/confirm)
export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/checkout">) {
  try {
    const { id } = await ctx.params;
    // 결제는 계정(Bearer)으로만 — 세션 키만으로는 주문을 만들지 않는다
    const user = await getAuthUser(req.headers.get("authorization")).catch(() => null);
    const userId = user?.id ?? null;
    const s = await loadSession(id, { key: null, userId });
    const r = await createOrder(s, userId, await readJson(req), { email: user?.email ?? null, country: req.headers.get("x-vercel-ip-country") });
    // 기간 한정 무료 열람 계정이면 결제 뒤와 같이 리포트를 만든다(lib/billing/compAccess.ts)
    if ("comp" in r) after(() => generateReport(s.id));
    return NextResponse.json(r);
  } catch (e) {
    return fail(e, req);
  }
}
