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
  { timeoutMs = 12000, maxOutputTokens = 800 }: { timeoutMs?: number; maxOutputTokens?: number } = {},
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
  const text = response.output_text?.trim();
  if (!text) throw new Error("AI가 빈 응답을 반환함");
  return text;
}
