import { NextResponse } from "next/server";
import { createOrder, loadSession } from "@/lib/server/session";
import { authFrom, fail, readJson } from "@/lib/server/http";

// 결제 주문 만들기(로그인한 본인 결과만): 아직 결제 전인지 확인하고 금액은 서버가 정한다. 돌려준 orderId로 토스 결제창을 연다.
export const runtime = "nodejs";

export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/checkout">) {
  try {
    const { id } = await ctx.params;
    const { userId } = await authFrom(req);
    // 결제는 계정(Bearer)으로만 — 세션 키만으로는 주문을 만들지 않는다
    const s = await loadSession(id, { key: null, userId });
    return NextResponse.json(await createOrder(s, userId, await readJson(req)));
  } catch (e) {
    return fail(e);
  }
}
