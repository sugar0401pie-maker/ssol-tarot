import "server-only";
import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";

// 타로 앱에서 AI를 부르는 유일한 곳. 모델·회사를 바꿀 때 여기만 고친다.
// 스펙은 "저비용 모델 [확인필요]" — 쏘웰라가 쓰는 모델을 기본값으로 두고 env로 바꿀 수 있게 했다.
const MODEL = process.env.TAROT_AI_MODEL || "gpt-5.6-luna";

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// 시스템 프롬프트(고정) + 사용자 블록 → 응답 텍스트. 실패하면 예외(호출한 쪽이 대체 동작을 정한다).
// reasoningEffort: 쓰기 전에 생각하는 양. 지정하지 않으면 모델 기본값(꽤 오래 생각함). 짧은 글을 제한 시간 안에 받아야 하는
// 호출(C — 2~4쪽 고민 맞춤 한 줄, 12초)에 "low"를 준다(2026-10-23: 기본값으로는 C가 12초를 넘겨 맞춤 한 줄이 자주 빠졌음).
// 모델이 그 값을 받지 않으면(400) 지정 없이 한 번 더 부른다 — 이 옵션 때문에 호출 자체가 실패하는 일은 없게.
export async function generateText(
  system: string,
  user: string,
  { timeoutMs = 12000, maxOutputTokens = 800, label = "AI", reasoningEffort }: { timeoutMs?: number; maxOutputTokens?: number; label?: string; reasoningEffort?: ReasoningEffort } = {},
): Promise<string> {
  const started = Date.now();
  const call = (effort: ReasoningEffort | undefined) =>
    new OpenAI({ timeout: Math.max(1000, timeoutMs - (Date.now() - started)), maxRetries: 0 }).responses.create({
      model: MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_output_tokens: maxOutputTokens,
      ...(effort ? { reasoning: { effort } } : {}),
    });
  let response;
  try {
    response = await call(reasoningEffort);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (!reasoningEffort || status !== 400) throw e;
    console.warn(`[tarot-ai] ${label} reasoning.effort=${reasoningEffort} 거부됨 — 지정 없이 다시 호출`);
    response = await call(undefined);
  }
  // 건당 비용 확인용(스펙 12장 체크리스트): 토큰 수와 모델만 남긴다 — 고민 원문·응답 문장은 절대 로그에 넣지 않는다.
  const u = response.usage;
  if (u) console.info(`[tarot-ai] ${label} model=${MODEL} in=${u.input_tokens} out=${u.output_tokens} reasoning=${u.output_tokens_details?.reasoning_tokens ?? 0}`);
  // 길이 한도 등으로 잘린 응답(incomplete)은 쓰지 않는다(스펙 체크리스트 — 저장·노출 금지).
  if (response.status && response.status !== "completed") throw new Error(`AI 응답이 완료되지 않음(${response.status})`);
  const text = response.output_text?.trim();
  if (!text) throw new Error("AI가 빈 응답을 반환함");
  return text;
}
