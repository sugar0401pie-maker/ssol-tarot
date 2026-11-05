import "server-only";
import { createAdminClient } from "./supabaseAdmin";

// 누적 인원 집계(owner 2026-11-02, 표 tarot_daily_counts). 숫자만 1 올린다 — 사람·고민 정보는 넘기지 않는다.
// 집계는 부가 기능이라 실패해도(표 없음·오류) 테스트 흐름을 막지 않고 경고만 남긴다.
export type CountMetric = "started" | "result" | "safety" | "paid" | "visit";

export async function countEvent(metric: CountMetric): Promise<void> {
  try {
    const { error } = await createAdminClient().rpc("tarot_count_inc", { p_metric: metric });
    if (error) console.warn("누적 집계 실패:", metric, error.message);
  } catch (e) {
    console.warn("누적 집계 실패:", metric, e instanceof Error ? e.message : "unknown");
  }
}
