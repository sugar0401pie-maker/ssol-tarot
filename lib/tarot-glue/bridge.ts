// 3쪽 연결 한 줄(owner 2026-11-02): '두 장 중간 결과'(그동안·지금은·가로막아 온 것) 뒤, "두 장을 종합하면…" 앞에 붙는다.
// C(3장째 뽑는 순간 부르는 AI)가 같은 호출에서 bridge 칸으로 쓴다 — AI 호출을 늘리지 않는다.
// 결제 전에 보이는 쪽이라 결론 쪽 선택지 이름·결론 낱말·세 번째 카드 이름은 막는다. 통과 못 하면 그 줄 없이.
import { ruleHitsV4, revealsConclusion } from "../tarot/validateV4.js";
import { cleanOption } from "../tarot/decision.js";

type FrameLike = { options?: string[] | null; options_ranked?: string[] | null } | null | undefined;

export function validateBridge(raw: unknown, { frame, option, hiddenNames = [], violence = false }: {
  frame: FrameLike; option?: string | null; hiddenNames?: string[]; violence?: boolean;
}): string | null {
  let obj: any = raw;
  if (typeof raw === "string") {
    try { obj = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()); } catch { return null; }
  }
  const t = String(obj?.bridge ?? "").trim();
  if (t.length < 20 || t.length > 100) return null;
  if ((t.match(/[.?!](?=\s|$)/g) || []).length !== 1 || !/요\.$/.test(t)) return null;
  if (ruleHitsV4(t, { violence }).length) return null;
  if (revealsConclusion(t, { frame, option: option ? cleanOption(option) : null }).length) return null;
  const names = [...(frame?.options_ranked ?? frame?.options ?? []).map(cleanOption), ...hiddenNames].filter(Boolean);
  if (names.some((n) => t.includes(n))) return null;
  return t;
}
