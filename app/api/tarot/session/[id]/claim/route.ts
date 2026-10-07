import { NextResponse } from "next/server";
import { claim } from "@/lib/server/session";
import { authFrom, fail } from "@/lib/server/http";
import { loadSession } from "@/lib/server/session";

// 결과 저장: 게스트 키를 가진 사람이 로그인한 뒤 누르면 이 결과를 그 계정에 연결한다(쏘웰라 마이페이지에 보임).
export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/claim">) {
  try {
    const { id } = await ctx.params;
    const auth = await authFrom(req);
    // 연결은 게스트 키로만 허용 — 남의 결과 id만 알아서는 자기 계정에 붙일 수 없게.
    const s = await loadSession(id, { key: auth.key, userId: null });
    return NextResponse.json(await claim(s, auth.userId));
  } catch (e) {
    return fail(e);
  }
}
