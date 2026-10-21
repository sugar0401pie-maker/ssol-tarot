import { NextResponse } from "next/server";
import { listResults } from "@/lib/server/session";
import { authFrom, fail } from "@/lib/server/http";

// 내 결과 목록(로그인 필요). 응답에는 날짜·카드만 — 고민 원문·해석 본문 없음.
export async function GET(req: Request) {
  try {
    const { userId } = await authFrom(req);
    return NextResponse.json(await listResults(userId), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
