import { NextResponse, after } from "next/server";
import { shuffle, runClassification } from "@/lib/server/session";
import { fail, sessionFrom } from "@/lib/server/http";

// 3. 새 셔플(다시 섞을 때마다 호출). 카드 순서는 응답에 넣지 않는다 — {shuffleId, count}만.
export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/shuffle">) {
  try {
    const { id } = await ctx.params;
    const { startClassification, ...r } = await shuffle(await sessionFrom(req, id));
    // 다시 묻기에 답하지 않고 섞기로 넘어왔으면 건너뛴 것으로 보고 분류를 시작한다(v2.3.14).
    if (startClassification) after(() => runClassification(id, []));
    return NextResponse.json(r);
  } catch (e) {
    return fail(e, req);
  }
}
