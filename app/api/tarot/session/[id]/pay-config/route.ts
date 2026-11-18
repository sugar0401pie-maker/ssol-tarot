import { NextResponse } from "next/server";
import { loadSession, payConfig } from "@/lib/server/session";
import { fail } from "@/lib/server/http";
import { getAuthUser } from "@/lib/server/supabaseAdmin";

// 결제 화면 설정: 이 결과의 통화(KRW/USD)와 그 통화 상점의 클라이언트 키(공개 값). 계정 또는 결과 접근 키로 연다.
// 시크릿 키는 보내지 않는다. 통화는 서버가 세션 언어로 정한다(브라우저 값을 믿지 않음).
export const runtime = "nodejs";

export async function GET(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/pay-config">) {
  try {
    const { id } = await ctx.params;
    const user = await getAuthUser(req.headers.get("authorization")).catch(() => null);
    const s = await loadSession(id, { key: req.headers.get("x-tarot-key"), userId: user?.id ?? null }); // 로그인 없이 결제(2026-11-18)는 결과 접근 키로
    return NextResponse.json(payConfig(s), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return fail(e, req);
  }
}
