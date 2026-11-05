import { NextResponse } from "next/server";
import { helplinesFor } from "@/lib/safety/helplinesEn";

// 영문판 위기 안내 화면이 접속 국가의 상담 전화를 고르는 데 쓴다(Vercel이 붙여 주는 국가 헤더만 읽음 — 저장하지 않음).
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const country = req.headers.get("x-vercel-ip-country");
  return NextResponse.json({ country: country ?? null, ...helplinesFor(country) }, { headers: { "Cache-Control": "no-store" } });
}
