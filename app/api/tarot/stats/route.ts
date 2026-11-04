import { NextResponse } from "next/server";
import { DISPLAY_PARTICIPANTS } from "@/lib/stats/participants";

// 인트로의 "벌써 {count}명이 쏠 타로 하우스를 다녀갔어요". 숫자는 /about과 같은 곳(lib/stats/participants.ts)에서.
export async function GET() {
  return NextResponse.json({ count: DISPLAY_PARTICIPANTS }, { headers: { "Cache-Control": "public, max-age=60" } });
}
