import { NextResponse, after } from "next/server";
import { pick, prepareResult } from "@/lib/server/session";
import { fail, readJson, sessionFrom } from "@/lib/server/http";

export const maxDuration = 120; // 3장째 뒤 백그라운드: 분류 대기(최대 40초) + C(20초) + 검수(20초)

// 4. 사용자가 누른 자리 → 그 카드. 3장째면 응답과 동시에 결과 준비(연결 한 줄 AI)를 백그라운드로 시작.
export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/pick">) {
  try {
    const { id } = await ctx.params;
    const r = await pick(await sessionFrom(req, id), await readJson(req));
    if (r.isLast) after(() => prepareResult(id));
    return NextResponse.json(r);
  } catch (e) {
    return fail(e);
  }
}
