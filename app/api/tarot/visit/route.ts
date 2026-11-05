import { countEvent } from "@/lib/server/counters";

// 첫 화면 방문 수(owner 2026-11-05) — 날짜별 숫자만 1 올린다(사람·기기 정보 없음). 브라우저가 탭 묶음(sessionStorage)당 한 번만 부른다.
// 누구나 부를 수 있는 숫자라 정확한 순방문자 수가 아니라 '대략의 방문 수'로 본다. 실패해도 화면에는 영향 없음.
export async function POST() {
  await countEvent("visit");
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
