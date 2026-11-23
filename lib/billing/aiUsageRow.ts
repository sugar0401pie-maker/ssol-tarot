// AI 사용량 한 줄(owner 2026-11-23 "리포트마다 실제 토큰 수를 DB에 기록") — 표 tarot_ai_usage(마이그레이션 20261123000000).
// 토큰 수·모델·단계 이름·결과 번호만 담는다. 고민 글·AI가 쓴 문장은 절대 넣지 않는다.
// 순수 함수라 테스트로 모양을 확인한다(lib/billing/aiUsageRow.test.ts).
export type AiKind = "text" | "embed";
export type AiUsageInput = {
  kind: AiKind;
  stage: string; // A·A2·C·D·E1·E2·A-retry·A2-sub·A+A2·embed 등 — 호출할 때 붙이는 label
  model: string; // 실제로 응답한 모델 이름(OpenAI가 돌려준 값)
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  ok?: boolean; // 응답을 실제로 썼는지(잘린 응답·빈 응답이면 false — 토큰은 청구되므로 그래도 기록)
};
export type AiUsageCtx = { sessionId: string | null; locale: string | null };

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function aiUsageRow(u: AiUsageInput, ctx: AiUsageCtx | null, app = "tarot") {
  return {
    app,
    locale: ctx?.locale === "en" ? "en" : ctx?.locale === "ko" ? "ko" : null,
    session_id: ctx?.sessionId && UUID_RE.test(ctx.sessionId) ? ctx.sessionId : null,
    kind: u.kind,
    stage: String(u.stage || "AI").slice(0, 40),
    model: String(u.model || "unknown").slice(0, 80),
    input_tokens: n(u.inputTokens),
    cached_input_tokens: n(u.cachedInputTokens),
    output_tokens: n(u.outputTokens),
    reasoning_tokens: n(u.reasoningTokens),
    ok: u.ok !== false,
  };
}
