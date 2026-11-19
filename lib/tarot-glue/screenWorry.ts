// 고민 원문의 서버 키워드 확인. v2.5부터 운영 키워드는 tarot_data.json의 safety_keywords(엑셀 '안전키워드' 시트)에
// 있으므로, 원본 screenText에 반드시 그 사전을 넘긴다 — 넘기지 않으면 코드에 남은 옛 기본 목록만 써서
// v2.5에서 추가된 위험·주의·폭력 단어를 놓친다.
// 2026-11-19 owner: 카드 멈춤(urgent)은 자기 죽음의 구체적 시기·장소를 말할 때만(applyPlanRule) — 그 밖의 직접 표현은 watch.
import data from "../../data/tarot_data.json" with { type: "json" };
import { screenText } from "../tarot/safety.js";
import { applyPlanRule } from "./concretePlan.ts";

export function screenWorry(text: string) {
  return applyPlanRule(screenText(text, data.safety_keywords), text);
}
