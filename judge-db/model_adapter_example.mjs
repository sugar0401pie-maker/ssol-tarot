// 모델 어댑터 예시 — node run_eval.mjs model ./model_adapter_example.mjs
// callModel({ system, user }) → 모델이 낸 문자열(JSON). 운영 모델·키·엔드포인트는 개발 환경 값으로 바꿔 씀.
// 아래는 Anthropic Messages API 형식 예시(환경 변수 ANTHROPIC_API_KEY, TAROT_MODEL). 다른 제공자면 이 함수만 바꾸면 됨.
// 시스템 프롬프트는 매번 같으므로 프롬프트 캐시를 켜 둠.
export async function callModel({ system, user }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.TAROT_MODEL, max_tokens: 300, temperature: 0,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error(`model ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.content || []).map((c) => c.text || "").join("");
}
