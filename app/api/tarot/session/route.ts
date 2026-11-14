import { NextResponse, after } from "next/server";
import { createSession } from "@/lib/server/session";
import { warmFrameIndexes } from "@/lib/server/frameExamples";
import { authFrom, fail, readJson } from "@/lib/server/http";

// 1. 세션 시작: 닉네임·경험 선택값 저장 → 게스트 접근 키 발급(로그인돼 있으면 계정에도 연결). 로그인 없으면 하루 횟수 제한.
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const { userId } = await authFrom(req);
    // 고민 쓰기 전에 비슷한 고민 색인을 미리 읽어 둔다(응답 뒤, 같은 서버 인스턴스면 제출 때 바로 씀).
    after(() => warmFrameIndexes(body.locale === "en" ? "en" : "ko"));
    return NextResponse.json(await createSession({ nickname: body.nickname, experience: body.experience, userId, headers: req.headers, locale: body.locale, termsConsent: body.termsConsent, utm: body.utm }));
  } catch (e) {
    return fail(e, req);
  }
}
