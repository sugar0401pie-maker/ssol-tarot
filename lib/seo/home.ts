// 첫 화면(/) 검색·링크 미리보기 문구 — 2026-11-16 owner 시트 v1.1.1(lib/seo/pages.ts의 "/" 행)로 바뀜.
// 리포트 가격은 지금 가격(currentReportPrice — 2026-11-21부터 끝나는 날 없이 990원) — 첫 화면은 1시간마다 다시 만든다(app/(ko)/page.tsx revalidate).
import { pageMeta } from "./pages.ts";

export function homeMeta(now: Date = new Date()) {
  return pageMeta("/", now)!;
}
