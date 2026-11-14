import { NextResponse, after } from "next/server";
import { submitWorry, runClassification } from "@/lib/server/session";
import { fail, readJson, sessionFrom } from "@/lib/server/http";

export const maxDuration = 60;

// 2. 고민 제출({text}) 또는 건너뛰기({skip:true}). 안전 키워드는 즉시 확인하고(urgent면 안전 안내),
// 그 외에는 바로 응답한 뒤 AI 분류를 백그라운드로 돌린다(셔플 연출 동안).
export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/worry">) {
  try {
    const { id } = await ctx.params;
    const s = await sessionFrom(req, id);
    const r = await submitWorry(s, await readJson(req));
    if (r.needsClassification) after(() => runClassification(id));
    // v2.3.14 다시 묻기: 짧은 글(B칸)이면 첫 질문을 함께 돌려주고, 분류는 답을 받은 뒤에(…/followup) 시작한다.
    return NextResponse.json({ urgent: r.urgent, followup: "followup" in r ? r.followup : null });
  } catch (e) {
    return fail(e, req);
  }
}
