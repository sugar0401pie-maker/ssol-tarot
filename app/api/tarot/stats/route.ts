import { NextResponse } from "next/server";

// 인트로의 "벌써 {count}명이 쏠 타로 하우스를 다녀갔어요".
// owner 2026-10-21 결정: 당분간 실제 세션 수 대신 고정 숫자 1,294명을 보여 준다(되돌릴 때는 아래 줄을 지우고
// participantCount()(lib/server/session.ts — 실제 tarot_sessions 수)를 다시 쓰면 된다).
const DISPLAY_PARTICIPANTS = 1294;

export async function GET() {
  return NextResponse.json({ count: DISPLAY_PARTICIPANTS }, { headers: { "Cache-Control": "public, max-age=60" } });
}
