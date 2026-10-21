import "server-only";
import OpenAI from "openai";

// 타로 앱에서 AI를 부르는 유일한 곳. 모델·회사를 바꿀 때 여기만 고친다.
// 스펙은 "저비용 모델 [확인필요]" — 쏘웰라가 쓰는 모델을 기본값으로 두고 env로 바꿀 수 있게 했다.
const MODEL = process.env.TAROT_AI_MODEL || "gpt-5.6-luna";

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// 시스템 프롬프트(고정) + 사용자 블록 → 응답 텍스트. 실패하면 예외(호출한 쪽이 대체 동작을 정한다).
export async function generateText(
  system: string,
  user: string,
  { timeoutMs = 12000, maxOutputTokens = 800, label = "AI" }: { timeoutMs?: number; maxOutputTokens?: number; label?: string } = {},
): Promise<string> {
  const client = new OpenAI({ timeout: timeoutMs, maxRetries: 0 });
  const response = await client.responses.create({
    model: MODEL,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_output_tokens: maxOutputTokens,
  });
  // 건당 비용 확인용(스펙 12장 체크리스트): 토큰 수와 모델만 남긴다 — 고민 원문·응답 문장은 절대 로그에 넣지 않는다.
  const u = response.usage;
  if (u) console.info(`[tarot-ai] ${label} model=${MODEL} in=${u.input_tokens} out=${u.output_tokens} reasoning=${u.output_tokens_details?.reasoning_tokens ?? 0}`);
  // 길이 한도 등으로 잘린 응답(incomplete)은 쓰지 않는다(스펙 체크리스트 — 저장·노출 금지).
  if (response.status && response.status !== "completed") throw new Error(`AI 응답이 완료되지 않음(${response.status})`);
  const text = response.output_text?.trim();
  if (!text) throw new Error("AI가 빈 응답을 반환함");
  return text;
}
