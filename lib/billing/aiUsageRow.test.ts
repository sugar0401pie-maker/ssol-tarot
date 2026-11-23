import { test } from "node:test";
import assert from "node:assert/strict";
import { aiUsageRow } from "./aiUsageRow.ts";

test("AI 사용량 한 줄: 토큰·모델·단계·결과 번호만, 이상한 값은 0·null로", () => {
  const id = "3e487fb1-1111-4222-8333-444455556666";
  const r = aiUsageRow({ kind: "text", stage: "D", model: "gpt-5.6-luna-2026", inputTokens: 5210, cachedInputTokens: 1024, outputTokens: 1880, reasoningTokens: 640 }, { sessionId: id, locale: "ko" });
  assert.deepEqual(r, { app: "tarot", locale: "ko", session_id: id, kind: "text", stage: "D", model: "gpt-5.6-luna-2026", input_tokens: 5210, cached_input_tokens: 1024, output_tokens: 1880, reasoning_tokens: 640, ok: true });
  const bad = aiUsageRow({ kind: "embed", stage: "", model: "", inputTokens: -3, outputTokens: Number.NaN, ok: false }, { sessionId: "not-a-uuid", locale: "fr" });
  assert.equal(bad.session_id, null);
  assert.equal(bad.locale, null);
  assert.equal(bad.input_tokens, 0);
  assert.equal(bad.output_tokens, 0);
  assert.equal(bad.stage, "AI");
  assert.equal(bad.model, "unknown");
  assert.equal(bad.ok, false);
  assert.equal(aiUsageRow({ kind: "text", stage: "C", model: "m" }, null).session_id, null);
  // 글(고민·응답)을 담는 칸이 없다
  assert.deepEqual(Object.keys(r).sort(), ["app", "cached_input_tokens", "input_tokens", "kind", "locale", "model", "ok", "output_tokens", "reasoning_tokens", "session_id", "stage"]);
});
