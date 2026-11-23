import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { aiUsageRow, type AiUsageCtx, type AiUsageInput } from "@/lib/billing/aiUsageRow";
import { createAdminClient } from "./supabaseAdmin";

// AI 호출마다 실제 토큰 수를 표 tarot_ai_usage에 남긴다(owner 2026-11-23). 어느 결과(세션)의 호출인지는
// 호출하는 곳마다 인자로 넘기지 않고 이 '작업 맥락'으로 안다 — runClassification·prepareResult·generateReport 등을 withAiSession으로 감싼다.
// 기록은 부가 기능이라 실패해도(표 없음 등) AI 응답·결과 흐름은 그대로, 경고만 한 번.
const store = new AsyncLocalStorage<AiUsageCtx>();

export function withAiSession<T>(sessionId: string | null, locale: string | null, fn: () => Promise<T>): Promise<T> {
  return store.run({ sessionId, locale }, fn);
}
/** 맥락을 연 뒤에야 언어를 아는 경우(세션을 읽은 다음) 채워 넣는다. */
export function setAiLocale(locale: string | null) {
  const c = store.getStore();
  if (c) c.locale = locale;
}

let warned = false;
export async function recordAiUsage(u: AiUsageInput): Promise<void> {
  try {
    const { error } = await createAdminClient().from("tarot_ai_usage").insert(aiUsageRow(u, store.getStore() ?? null));
    if (error && !warned) {
      warned = true;
      console.warn("AI 사용량 기록 실패(마이그레이션 20261123000000 실행 전일 수 있음):", error.message);
    }
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn("AI 사용량 기록 실패:", e instanceof Error ? e.message : "unknown");
    }
  }
}
