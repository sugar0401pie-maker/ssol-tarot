import { NextResponse } from "next/server";
import { shuffle } from "@/lib/server/session";
import { fail, sessionFrom } from "@/lib/server/http";

// 3. 새 셔플(다시 섞을 때마다 호출). 카드 순서는 응답에 넣지 않는다 — {shuffleId, count}만.
export async function POST(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/shuffle">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await shuffle(await sessionFrom(req, id)));
  } catch (e) {
    return fail(e);
  }
}
