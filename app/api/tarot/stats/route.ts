import { NextResponse } from "next/server";
import { participantCount } from "@/lib/server/session";

// 인트로의 "벌써 {count}명이 쏠 타로 하우스를 다녀갔어요". 실패하면 null(화면은 그 줄을 숨김).
export async function GET() {
  try {
    return NextResponse.json({ count: await participantCount() }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ count: null });
  }
}
