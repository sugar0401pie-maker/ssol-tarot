import { NextResponse } from "next/server";
import { getResult } from "@/lib/server/session";
import { fail, sessionFrom } from "@/lib/server/http";

// 5. 결과: {status: "preparing"} 또는 {status: "ready", 무료 1~3번 + 안전 박스 + 잠금 미리보기}.
// 유료 본문(4~8번)은 결제 연동 전까지 어디에서도 만들거나 보내지 않는다.
export async function GET(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/result">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getResult(await sessionFrom(req, id)), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
