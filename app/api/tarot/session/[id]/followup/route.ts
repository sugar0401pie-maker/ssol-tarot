import { NextResponse, after } from "next/server";
import { submitFollowup, runClassification } from "@/lib/server/session";
import { fail, readJson, sessionFrom } from "@/lib/server/http";

export const maxDuration = 60;

// v2.3.14 짧은 고민에 다시 묻기: 고른 답 {answers:[{q,id}]}(건너뛰면 []). 답이 질문 순서와 맞지 않으면 건너뛴 것으로 본다.
// 분류(A·A2)는 여기서 백그라운드로 시작한다(셔플 연출 동안).
export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/followup">) {
  try {
    const { id } = await ctx.params;
    const r = await submitFollowup(await sessionFrom(req, id), await readJson(req));
    if (r.start) after(() => runClassification(id, r.answers, r.guessed));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, req);
  }
}
