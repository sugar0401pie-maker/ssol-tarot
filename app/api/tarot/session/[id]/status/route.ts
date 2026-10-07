import { NextResponse } from "next/server";
import { getStatus } from "@/lib/server/session";
import { fail, sessionFrom } from "@/lib/server/http";

// 셔플·뽑기 도중 화면이 AI 분류의 urgent 여부를 확인하는 곳(그 외 분류값은 보내지 않는다).
export async function GET(req: Request, ctx: RouteContext<"/api/tarot/session/[id]/status">) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json(await getStatus(await sessionFrom(req, id)));
  } catch (e) {
    return fail(e);
  }
}
