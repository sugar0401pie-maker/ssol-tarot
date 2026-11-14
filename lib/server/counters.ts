import "server-only";
import { createAdminClient } from "./supabaseAdmin";

// 누적 인원 집계(owner 2026-11-02, 표 tarot_daily_counts). 숫자만 1 올린다 — 사람·고민 정보는 넘기지 않는다.
// 집계는 부가 기능이라 실패해도(표 없음·오류) 테스트 흐름을 막지 않고 경고만 남긴다.
// embed_ok/embed_fallback: 비슷한 고민 찾기에서 의미 검색(임베딩)을 쓴 횟수 / 쓰려다 글자 검색으로 대신한 횟수(2026-11-09).
export type CountMetric = "started" | "result" | "safety" | "paid" | "visit" | "embed_ok" | "embed_fallback";

export async function countEvent(metric: CountMetric): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("tarot_count_inc", { p_metric: metric });
    if (error) console.warn("누적 집계 실패:", metric, error.message);
  } catch (e) {
    console.warn("누적 집계 실패:", metric, e instanceof Error ? e.message : "unknown");
  }
}

// 광고 소재(UTM)별 날짜 숫자(owner 2026-11-14, 표 tarot_utm_counts — 마이그레이션 20261114000000). utm이 없는 결과는 세지 않는다.
// 사람·고민 정보 없이 광고 이름표와 숫자만. 실패해도(표 없음 등) 흐름은 그대로, 경고만.
export type UtmMetric = "visit" | "started" | "worry" | "skip" | "result" | "paid" | "paid_krw" | "paid_usd_cents";
export async function countUtm(utm: { source?: string; campaign?: string; content?: string } | null | undefined, metric: UtmMetric, by = 1): Promise<void> {
  if (!utm?.source) return;
  try {
    const { error } = await createAdminClient().rpc("tarot_utm_inc", { p_source: utm.source, p_campaign: utm.campaign ?? "", p_content: utm.content ?? "", p_metric: metric, p_by: by });
    if (error) console.warn("광고 소재 집계 실패:", metric, error.message);
  } catch (e) {
    console.warn("광고 소재 집계 실패:", metric, e instanceof Error ? e.message : "unknown");
  }
}
