import { countUtm } from "@/lib/server/counters";
import { readJson } from "@/lib/server/http";
import { sanitizeUtm } from "@/lib/tarot-glue/utm";

// 광고 주소(utm_source가 붙은 주소)로 들어온 방문 수(owner 2026-11-14). 브라우저가 같은 탭 묶음·같은 광고 값에 한 번만 부른다.
// 누구나 부를 수 있는 숫자라 '대략의 방문 수'로 본다. 실패해도 화면에는 영향 없음.
export async function POST(req: Request) {
  const body = (await readJson(req)) as { utm?: unknown };
  await countUtm(sanitizeUtm(body?.utm), "visit");
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
