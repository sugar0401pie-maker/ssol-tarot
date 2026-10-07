import { NextResponse } from "next/server";
import { createSession } from "@/lib/server/session";
import { authFrom, fail, readJson } from "@/lib/server/http";

// 1. 세션 시작: 닉네임·경험 선택값 저장 → 게스트 접근 키 발급(로그인돼 있으면 계정에도 연결).
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const { userId } = await authFrom(req);
    return NextResponse.json(await createSession({ nickname: body.nickname, experience: body.experience, userId }));
  } catch (e) {
    return fail(e);
  }
}
